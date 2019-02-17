'use strict';

const Property = require('./property');
const ReadonlyProperty = require('./readonly-property');
const { Sonos } = require("sonos");
const os = require("os");
const mkdirp = require("mkdirp");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const output = require("image-output");
const imageType = require("image-type");
const pixels = require("image-pixels");

let Device, Constants;
try {
    Device = require('../device');
    Constants = require('../addon-constants');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Device = gwa.Device;
    Constants = gwa.Constants;
}

function getModeFromProps(shuffle, repeat) {
    if(!shuffle && repeat === 'None') {
        return 'NORMAL';
    }
    else if(repeat === 'None') {
        return 'SHUFFLE_NOREPEAT';
    }
    else if(shuffle && repeat === 'All') {
        return 'SHUFFLE';
    }
    else if(repeat === 'All'){
        return 'REPEAT_ALL';
    }
    else if(shuffle && repeat === 'One') {
        return 'SHUFFLE_REPEAT_ONE';
    }
    else if(repeat === 'One') {
        return 'REPEAT_ONE';
    }
}

function getMediaPath() {
    let dir;
    if(process.env.hasOwnProperty('MOZIOT_HOME')) {
        dir = process.env.MOZIOT_HOME;
    }
    else {
        dir = path.join(os.homedir(), '.mozilla-iot');
    }
    return path.join(dir, 'media', 'sonos');
}

class Speaker extends Device {
    constructor(adapter, ip, device) {
        super(adapter, ip);

        this.device = device;
        this.name = ip;
        this.type = Constants.THING_TYPE_UNKNOWN_THING;

        this.properties.set('volume', new Property(this, 'volume', {
            title: "Volume",
            type: 'integer',
            unit: 'percent',
            "@type": "LevelProperty"
        }, 100));
        this.properties.set('playing', new Property(this, 'playing', {
            title: "Playing",
            type: 'boolean',
            "@type": "BooleanProperty"
        }, false));
        this.properties.set('shuffle', new Property(this, 'shuffle', {
            title: "Shuffle",
            type: 'boolean',
            "@type": "BooleanProperty"
        }, false));
        this.properties.set('repeat', new Property(this, 'repeat', {
            title: "Repeat",
            type: 'string',
            "@type": "EnumProperty",
            enum: [
                'None',
                'One',
                'All',
            ]
        }, false));
        this.properties.set('crossfade', new Property(this, 'crossfade', {
            title: "Crossfade",
            type: "boolean",
            "@type": "BooleanProperty"
        }, false));
        this.properties.set('track', new ReadonlyProperty(this, 'track', {
            title: "Track",
            type: "string",
            "@type": "StringProperty"
        }, ''));
        this.properties.set('album', new ReadonlyProperty(this, 'album', {
            title: "Album",
            type: "string",
            "@type": "StringProperty"
        }, ''));
        this.properties.set('artist', new ReadonlyProperty(this, 'artist', {
            title: "Artist",
            type: "string",
            "@type": "StringProperty"
        }, ''));
        this.properties.set('progress', new Property(this, 'progress', {
            title: "Progress",
            type: "number",
            "@type": "LevelProperty"
        }, 0));
        this.properties.set('albumArt', new ReadonlyProperty(this, 'albumArt', {
            title: 'Album art',
            '@type': 'ImageProperty',
            links: [
                {
                    mediaType: 'image/png',
                    href: `/media/sonos/${this.id}/album.png`,
                    rel: 'alternate'
                }
            ]
        }, undefined));
        this.properties.set('muted', new Property(this, 'muted', {
            title: "Muted",
            type: "boolean",
            "@type": "BooleanProperty"
        }, false));
        this.currentDuration = 0;
        this.currentPosition = 0;

        //TODO eq
        //TODO loudness
        //TODO balance for stereo pairs
        //TODO actions? Like clear queue, stop
        //TODO fields like current track (album art), queue size
        //TODO queue track position property
        //TODO property for queue size/stopped?
        //TODO playback state when grouped
        //TODO play line-in
        //TODO action to play notification (needs file input and has a toggle for where to play)
        // Useful list of things: https://github.com/SoCo/SoCo/wiki/Sonos-UPnP-Services-and-Functions

        this.addAction('next', {
            title: "Next",
            description: "Skip current track and start playing next track in the queue"
        });
        this.addAction('prev', {
            title: "Previous",
            description: "Play previous track in the queue"
        });
        this.addAction('stop', {
            title: 'Stop',
            description: 'Stop current playback'
        });

        this.ready = this.fetchProperties().then(() => this.adapter.handleDeviceAdded(this));
    }

    async fetchProperties() {
        const name = await this.device.getName();
        this.setName(name);

        this.supportsFixedVolume = await this.getSupportsFixedVolume();
        let shouldGetVolume = true;
        if(this.supportsFixedVolume) {
            const hasFixedVolume = await this.getFixedVolume();
            shouldGetVolume = !hasFixedVolume;
            if(hasFixedVolume) {
                this.findProperty('volume').readOnly = true;
            }
        }
        if(shouldGetVolume) {
            const volume = await this.device.getVolume();
            this.updateProp('volume', volume * 100);
        }

        const muted = await this.device.getMuted();
        this.updateProp('muted', muted);

        await new Promise((resolve, reject) => {
            mkdirp(path.join(getMediaPath(), this.id), (e) => {
                if(!e) {
                    resolve();
                }
                else {
                    reject(e);
                }
            });
        });

        const state = await this.device.getCurrentState();
        this.updateProp('playing', state === 'playing');

        const currentTrack = await this.device.currentTrack();
        if(currentTrack.duration > 0) {
            this.updateProp('track', currentTrack.title);
            this.updateProp('album', currentTrack.album);
            this.updateProp('artist', currentTrack.artist);
            this.updateProp('progress', (currentTrack.position / currentTrack.duration) * 100);
            await this.updateAlbumArt(currentTrack.albumArtURL);
            this.currentDuration = currentTrack.duration;
            this.currentPosition = currentTrack.position;
            if(state === 'playing') {
                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
            }
        }
        //TODO current track change event

        const mode = await this.device.getPlayMode();
        this.updatePlayMode(mode);

        const crossFade = await this.getCrossfadeMode();
        this.updateProp('crossfade', crossFade);

        const groups = await this.device.getAllGroups();
        const groupDetails = {
            title: "Group/Ungroup",
            description: "Group Sonos players",
            input: {
                type: "object",
                required: [],
                properties: {}
            }
        };
        const playerInfo = await this.device.getZoneInfo();
        const groupId = `RINCON_${playerInfo.MACAddress.replace(/:/g, '')}`;
        for(const zone of groups) {
            if(!zone.ID.startsWith(groupId)) {
                const zoneCoordinator = zone.ZoneGroupMember.find((m) => m.UUID === zone.Coordinator);
                if(zoneCoordinator.Invisible != '1') {
                    groupDetails.input.properties[zoneCoordinator.ZoneName] = {
                        type: "boolean",
                        default: zone.ZoneGroupMember.some((m) => m.UUID.startsWith(groupId))
                    };
                    groupDetails.input.required.push(zoneCoordinator.ZoneName);
                }
            }
        }
        this.addAction('group', groupDetails);

        this.device.on('PlayState', (state) => {
            const playing = state === 'playing';
            this.updateProp('playing', playing);
            if(playing && !this.progressInterval && this.currentDuration) {
                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
            }
            else if(!playing && this.progressInterval) {
                this.clearProgress();
            }
        });

        this.device.on('PlaybackStopped', () => {
            this.updateProp('track', '');
            this.updateProp('artist', '');
            this.updateProp('album', '');
            this.updateProp('playing', false);
            this.updateProp('progress', 0);
            this.clearProgress();
        });

        this.device.on('CurrentTrack', (track) => {
            this.updateProp('track', track.title);
            this.updateProp('artist', track.artist);
            this.updateProp('album', track.album);
            this.updateAlbumArt(track.albumArtURI).catch(console.error);

            if(!isNaN(track.duration)) {
                this.currentDuration = track.duration;
                if(track.position) {
                    this.currentPosition = track.position;
                    this.updateProp('progress', (this.currentPosition / this.currentDuration) * 100);
                }
                else {
                    this.device.currentTrack().then((currentTrack) => {
                        this.currentDuration = currentTrack.duration;
                        this.currentPosition = currentTrack.position;
                        if(this.currentDuration != 0) {
                            this.updateProp('progress', (currentTrack.position / currentTrack.duration) * 100);
                            const isPlaying = this.findProperty('playing').value;
                            if(isPlaying && !this.progressInterval) {
                                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
                            }
                            else if(!isPlaying) {
                                this.clearProgress();
                            }
                        }
                        else {
                            this.updateProp('progress', 0);
                            this.clearProgress();
                        }
                    });
                }
            }
            else {
                this.currentDuration = 0;
                this.updateProp('progress', 0);
                this.clearProgress();
            }
        });

        this.device.on('AVTransport', (newValue) => {
            const mode = newValue.CurrentPlayMode;
            this.updatePlayMode(mode);
            this.updateProp('crossfade', newValue.CurrentCrossfadeMode != '0');
            if(!newValue.CurrentTrackMetaDataParsed) {
                this.updateProp('track', '');
                this.updateProp('artist', '');
                this.updateProp('album', '');
                this.currentDuration = 0;
                this.updateProp('progress', 0);
                this.clearProgress();
            }
        });

        this.device.on('Muted', (muted) => {
            this.updateProp('muted', muted);
        });

        //TODO update group action
        //TODO reconnect when event listening is lost?

        if(shouldGetVolume) {
            this.device.on('Volume', (volume) => {
                this.updateProp('volume', volume);
            });
        }
        //TODO else add listener for fixed volume to be disabled
    }

    get renderingControl() {
        if(!this._renderingControl) {
            this._renderingControl = this.device.renderingControlService();
        }
        return this._renderingControl;
    }

    get avTransport() {
        if(!this._avTransport) {
            this._avTransport = this.device.avTransportService();
        }
        return this._avTransport;
    }

    async getSupportsFixedVolume() {
        const response = await this.renderingControl._request('GetSupportsOutputFixed', {InstanceID: 0});
        return response.CurrentSupportsFixed != '0';
    }

    async getFixedVolume() {
        const response = await this.renderingControl._request('GetOutputFixed', {InstanceID: 0});
        return response.CurrentFixed != '0';
    }

    async getCrossfadeMode() {
        const response = await this.avTransport.GetCrossfadeMode();
        return response.CurrrentCrossfadeMode != '0';
    }

    updatePlayMode(mode) {
        this.updateProp('shuffle', mode && mode.startsWith('SHUFFLE'));
        let repeat = 'None';
        if(mode === 'REPEAT_ALL' || mode === 'SHUFFLE') {
            repeat = 'All';
        }
        else if(mode === 'REPEAT_ONE' || mode === 'SHUFFLE_REPEAT_ONE') {
            repeat = 'One';
        }
        this.updateProp('repeat', repeat);
    }

    updateProgress() {
        this.currentPosition += 1;
        this.updateProp('progress', (this.currentPosition / this.currentDuration) * 100);
    }

    clearProgress() {
        if(this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
    }

    async updateAlbumArt(url) {
        const artUrl = path.join(getMediaPath(), this.id, 'album.png');
        if(url) {
            const response = await fetch(url);
            const blob = await response.buffer();
            if(imageType(blob).mime == 'image/png') {
                await new Promise((resolve, reject) => {
                    fs.writeFile(artUrl, blob, (e) => {
                        if(e) {
                            reject(e);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            }
            else {
                const px = await pixels(blob);
                await output(px, artUrl);
            }
        }
        else {
            fs.stat
            await new Promise((resolve) => {
                fs.unlink(artUrl, (e) => {
                    resolve();
                });
            });
        }
    }

    updateProp(propertyName, value) {
        const property = this.findProperty(propertyName);
        if(property.value !== value) {
            property.setCachedValue(value);
            super.notifyPropertyChanged(property);
        }
    }

    async notifyPropertyChanged(property) {
        const newValue = property.value;
        switch(property.name) {
            case 'playing':
                if(newValue) {
                    await this.device.play();
                }
                else {
                    await this.device.pause();
                }
            break;
            case 'volume':
                if(this.supportsFixedVolume && await this.getFixedVolume()) {
                    this.findProperty('volume').readOnly = true;
                    throw new Error("Volume is fixed");
                }
                else {
                    this.findProperty('volume').readOnly = false;
                }
                await this.device.setVolume(newValue);
            break;
            case 'shuffle':
            case 'repeat':
                await this.device.setPlayMode(
                    getModeFromProps(
                        this.properties.get('shuffle').value,
                        this.properties.get('repeat').value
                    )
                );
            break;
            case 'crossfade':
                await this.avTransport.SetCrossfadeMode({ InstanceID: 0, CrossfadeMode: newValue });
            break;
            case 'progress':
                if(this.currentDuration > 0) {
                    const newPosition = Math.floor((newValue / 100) * this.currentDuration);
                    await this.device.seek(newPosition);
                    this.currentPosition = newPosition;
                }
                else {
                    throw "Can't change progress without track";
                }
            break;
            case 'muted':
                await this.device.setMuted(newValue);
            break;
        }
        super.notifyPropertyChanged(property);
    }

    async performAction(action) {
        switch(action.name) {
            case "next":
                action.start();
                await this.device.next();
                action.finish();
            break;
            case "prev":
                action.start();
                await this.device.previous();
                action.finish();
            break;
            case "stop":
                action.start();
                await this.device.stop();
                action.finish();
                break;
            case "group":
                action.start();
                //TODO only execute if the new group config is different from the current one.
                await this.device.leaveGroup();
                const topo = await this.device.getAllGroups();
                const topoCoordinators = topo.map((z) => z.ZoneGroupMember.find((m) => m.UUID === z.Coordinator));
                for(const input in action.input) {
                    if(action.input[input]) {
                        const deviceInfo = topoCoordinators.find((z) => z.ZoneName.toLowerCase() == input.toLowerCase());
                        const deviceIP = deviceInfo.Location.match(/^http:\/\/([^:]+)/)[1];
                        const dev = new Sonos(deviceIP);
                        await dev.joinGroup(this.name);
                    }
                }
                action.finish();
            break;
        }
    }
}
module.exports = Speaker;
