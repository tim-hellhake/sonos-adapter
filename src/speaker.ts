/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import { SonosProperty } from './property';
import { ReadonlyProperty } from './readonly-property';
import { Sonos } from 'sonos';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import output from 'image-output';
import imageType from 'image-type';
import pixels from 'image-pixels';
import jpeg from 'jpeg-js';
import { Device, Adapter } from 'gateway-addon';

function getModeFromProps(shuffle: boolean, repeat: string) {
    if (!shuffle && repeat === 'None') {
        return 'NORMAL';
    }
    else if (repeat === 'None') {
        return 'SHUFFLE_NOREPEAT';
    }
    else if (shuffle && repeat === 'All') {
        return 'SHUFFLE';
    }
    else if (repeat === 'All') {
        return 'REPEAT_ALL';
    }
    else if (shuffle && repeat === 'One') {
        return 'SHUFFLE_REPEAT_ONE';
    }
    else if (repeat === 'One') {
        return 'REPEAT_ONE';
    }

    return '';
}

function getMediaPath() {
    let dir: string | undefined;
    if (process.env.hasOwnProperty('MOZIOT_HOME')) {
        dir = process.env.MOZIOT_HOME;
    }
    else {
        dir = path.join(os.homedir(), '.mozilla-iot');
    }
    return path.join(dir || '', 'media', 'sonos');
}

export class Speaker extends Device {
    public ready: Promise<any>;
    currentDuration: number;
    currentPosition: number;
    supportsFixedVolume?: boolean;
    progressInterval?: NodeJS.Timeout;
    _renderingControl: any;
    _avTransport: any;

    constructor(adapter: Adapter, id: string, private device: any) {
        super(adapter, id);

        this.name = device.host;

        this.properties.set('volume', new SonosProperty(this, 'volume', {
            title: 'Volume',
            type: 'integer',
            unit: 'percent',
            '@type': 'LevelProperty'
        }, 100));
        this.properties.set('playing', new SonosProperty(this, 'playing', {
            title: 'Playing',
            type: 'boolean',
            '@type': 'BooleanProperty'
        }, false));
        this.properties.set('shuffle', new SonosProperty(this, 'shuffle', {
            title: 'Shuffle',
            type: 'boolean',
            '@type': 'BooleanProperty'
        }, false));
        this.properties.set('repeat', new SonosProperty(this, 'repeat', {
            title: 'Repeat',
            type: 'string',
            '@type': 'EnumProperty',
            enum: [
                'None',
                'One',
                'All',
            ]
        }, false));
        this.properties.set('crossfade', new SonosProperty(this, 'crossfade', {
            title: 'Crossfade',
            type: 'boolean',
            '@type': 'BooleanProperty'
        }, false));
        this.properties.set('track', new ReadonlyProperty(this, 'track', {
            title: 'Track',
            type: 'string',
            '@type': 'StringProperty'
        }));
        this.properties.set('album', new ReadonlyProperty(this, 'album', {
            title: 'Album',
            type: 'string',
            '@type': 'StringProperty'
        }));
        this.properties.set('artist', new ReadonlyProperty(this, 'artist', {
            title: 'Artist',
            type: 'string',
            '@type': 'StringProperty'
        }));
        this.properties.set('progress', new SonosProperty(this, 'progress', {
            title: 'Progress',
            type: 'number',
            '@type': 'LevelProperty'
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
        }));
        this.properties.set('muted', new SonosProperty(this, 'muted', {
            title: 'Muted',
            type: 'boolean',
            '@type': 'BooleanProperty'
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
            title: 'Next',
            description: 'Skip current track and start playing next track in the queue'
        });
        this.addAction('prev', {
            title: 'Previous',
            description: 'Play previous track in the queue'
        });
        this.addAction('stop', {
            title: 'Stop',
            description: 'Stop current playback'
        });

        this.ready = this.fetchProperties().then(() => this.adapter.handleDeviceAdded(this));
    }

    async fetchProperties() {
        const name = await this.device.getName();
        this.setTitle(name);

        this.supportsFixedVolume = await this.getSupportsFixedVolume();
        let shouldGetVolume = true;
        if (this.supportsFixedVolume) {
            const hasFixedVolume = await this.getFixedVolume();
            shouldGetVolume = !hasFixedVolume;
            if (hasFixedVolume) {
                this.findProperty('volume').readOnly = true;
            }
        }
        if (shouldGetVolume) {
            const volume = await this.device.getVolume();
            this.updateProp('volume', volume * 100);
        }

        const muted = await this.device.getMuted();
        this.updateProp('muted', muted);

        await new Promise((resolve, reject) => {
            mkdirp(path.join(getMediaPath(), this.id), (e) => {
                if (!e) {
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
        if (currentTrack.duration > 0) {
            this.updateProp('track', currentTrack.title);
            this.updateProp('album', currentTrack.album);
            this.updateProp('artist', currentTrack.artist);
            this.updateProp('progress', (currentTrack.position / currentTrack.duration) * 100);
            await this.updateAlbumArt(currentTrack.albumArtURL);
            this.currentDuration = currentTrack.duration;
            this.currentPosition = currentTrack.position;
            if (state === 'playing') {
                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
            }
        }
        //TODO current track change event

        const mode = await this.device.getPlayMode();
        this.updatePlayMode(mode);

        const crossFade = await this.getCrossfadeMode();
        this.updateProp('crossfade', crossFade);

        const groups = await this.device.getAllGroups();
        const req: any[] = []
        const props: { [key: string]: any } = {}
        const groupDetails = {
            title: 'Group/Ungroup',
            description: 'Group Sonos players',
            input: {
                type: 'object',
                required: req,
                properties: props
            }
        };
        const playerInfo = await this.device.getZoneInfo();
        const groupId = `RINCON_${playerInfo.MACAddress.replace(/:/g, '')}`;
        for (const zone of groups) {
            if (!zone.ID.startsWith(groupId)) {
                const zoneCoordinator = zone.ZoneGroupMember.find((m: any) => m.UUID === zone.Coordinator);
                if (zoneCoordinator.Invisible != '1') {
                    groupDetails.input.properties[zoneCoordinator.ZoneName] = {
                        type: 'boolean',
                        default: zone.ZoneGroupMember.some((m: any) => m.UUID.startsWith(groupId))
                    };
                    groupDetails.input.required.push(zoneCoordinator.ZoneName);
                }
            }
        }
        this.addAction('group', groupDetails);

        this.device.on('PlayState', (state: any) => {
            const playing = state === 'playing';
            this.updateProp('playing', playing);
            if (playing && !this.progressInterval && this.currentDuration) {
                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
            }
            else if (!playing && this.progressInterval) {
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

        this.device.on('CurrentTrack', (track: any) => {
            this.updateProp('track', track.title);
            this.updateProp('artist', track.artist);
            this.updateProp('album', track.album);
            this.updateAlbumArt(track.albumArtURI).catch(console.error);

            if (!isNaN(track.duration)) {
                this.currentDuration = track.duration;
                if (track.position) {
                    this.currentPosition = track.position;
                    this.updateProp('progress', (this.currentPosition / this.currentDuration) * 100);
                }
                else {
                    this.device.currentTrack()
                        .then((currentTrack: any) => {
                            this.currentDuration = currentTrack.duration;
                            this.currentPosition = currentTrack.position;
                            if (this.currentDuration != 0) {
                                this.updateProp('progress', (currentTrack.position / currentTrack.duration) * 100);
                                const isPlaying = this.findProperty('playing').value;
                                if (isPlaying && !this.progressInterval) {
                                    this.progressInterval = setInterval(() => this.updateProgress(), 1000);
                                }
                                else if (!isPlaying) {
                                    this.clearProgress();
                                }
                            }
                            else {
                                this.updateProp('progress', 0);
                                this.clearProgress();
                            }
                        })
                        .catch(() => this.assumeDisconnected());
                }
            }
            else {
                this.currentDuration = 0;
                this.updateProp('progress', 0);
                this.clearProgress();
            }
        });

        this.device.on('AVTransport', (newValue: any) => {
            const mode = newValue.CurrentPlayMode;
            this.updatePlayMode(mode);
            this.updateProp('crossfade', newValue.CurrentCrossfadeMode != '0');
            if (!newValue.CurrentTrackMetaDataParsed) {
                this.updateProp('track', '');
                this.updateProp('artist', '');
                this.updateProp('album', '');
                this.currentDuration = 0;
                this.updateProp('progress', 0);
                this.clearProgress();
            }
        });

        this.device.on('Muted', (muted: any) => {
            this.updateProp('muted', muted);
        });

        //TODO update group action

        if (shouldGetVolume) {
            this.device.on('Volume', (volume: any) => {
                this.updateProp('volume', volume);
            });
        }
        //TODO else add listener for fixed volume to be disabled
    }

    get renderingControl() {
        if (!this._renderingControl) {
            this._renderingControl = this.device.renderingControlService();
        }
        return this._renderingControl;
    }

    get avTransport() {
        if (!this._avTransport) {
            this._avTransport = this.device.avTransportService();
        }
        return this._avTransport;
    }

    async getSupportsFixedVolume() {
        const response = await this.renderingControl._request('GetSupportsOutputFixed', { InstanceID: 0 });
        return response.CurrentSupportsFixed != '0';
    }

    async getFixedVolume() {
        const response = await this.renderingControl._request('GetOutputFixed', { InstanceID: 0 });
        return response.CurrentFixed != '0';
    }

    async getCrossfadeMode() {
        const response = await this.avTransport.GetCrossfadeMode();
        return response.CurrrentCrossfadeMode != '0';
    }

    updatePlayMode(mode: string) {
        this.updateProp('shuffle', mode && mode.startsWith('SHUFFLE'));
        let repeat = 'None';
        if (mode === 'REPEAT_ALL' || mode === 'SHUFFLE') {
            repeat = 'All';
        }
        else if (mode === 'REPEAT_ONE' || mode === 'SHUFFLE_REPEAT_ONE') {
            repeat = 'One';
        }
        this.updateProp('repeat', repeat);
    }

    updateProgress() {
        this.currentPosition += 1;
        this.updateProp('progress', (this.currentPosition / this.currentDuration) * 100);
    }

    clearProgress() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = undefined;
        }
    }

    async updateAlbumArt(url: string) {
        const artUrl = path.join(getMediaPath(), this.id, 'album.png');
        let parsed = false;

        try {
            if (url) {
                const response = await fetch(url);
                const blob = await response.buffer();
                const type = imageType(blob);

                if (type) {
                    if (type.mime === 'image/png') {
                        await new Promise((resolve, reject) => {
                            fs.writeFile(artUrl, blob, (e) => {
                                if (e) {
                                    reject(e);
                                }
                                else {
                                    resolve();
                                }
                            });
                        });
                        parsed = true;
                    }
                    else if (type.mime === 'image/jpeg') {
                        const imageData = jpeg.decode(blob);
                        const px = await pixels(
                            blob,
                            {
                                width: imageData.width,
                                height: imageData.height,
                            }
                        );
                        await output(px, artUrl);
                        parsed = true;
                    }
                }
            }
        } catch (e) {
            console.warn(e);
        }

        if (!parsed) {
            await new Promise((resolve) => {
                if (fs.existsSync, artUrl) {
                    fs.unlink(artUrl, (_e) => {
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        }
    }

    updateProp(propertyName: string, value: any) {
        const property = this.findProperty(propertyName);
        if (property.value !== value) {
            property.setCachedValue(value);
            super.notifyPropertyChanged(property);
        }
    }

    async notifyPropertyChanged(property: any) {
        const newValue = property.value;
        try {
            switch (property.name) {
                case 'playing':
                    if (newValue) {
                        await this.device.play();
                    }
                    else {
                        await this.device.pause();
                    }
                    break;
                case 'volume':
                    if (this.supportsFixedVolume && await this.getFixedVolume()) {
                        this.findProperty('volume').readOnly = true;
                        throw new Error('Volume is fixed');
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
                            this.properties.get('shuffle')?.value,
                            this.properties.get('repeat')?.value
                        )
                    );
                    break;
                case 'crossfade':
                    await this.avTransport.SetCrossfadeMode({ InstanceID: 0, CrossfadeMode: newValue });
                    break;
                case 'progress':
                    if (this.currentDuration > 0) {
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
        catch (e) {
            this.assumeDisconnected();
        }
    }

    async performAction(action: any) {
        try {
            switch (action.name) {
                case 'next':
                    action.start();
                    await this.device.next();
                    action.finish();
                    break;
                case 'prev':
                    action.start();
                    await this.device.previous();
                    action.finish();
                    break;
                case 'stop':
                    action.start();
                    await this.device.stop();
                    action.finish();
                    break;
                case 'group':
                    action.start();
                    //TODO only execute if the new group config is different from the current one.
                    await this.device.leaveGroup();
                    const topo = await this.device.getAllGroups();
                    const topoCoordinators = topo.map((z: any) => z.ZoneGroupMember.find((m: any) => m.UUID === z.Coordinator));
                    for (const input in action.input) {
                        if (action.input[input]) {
                            const deviceInfo = topoCoordinators.find((z: any) => z.ZoneName.toLowerCase() == input.toLowerCase());
                            const deviceIP = deviceInfo.Location.match(/^http:\/\/([^:]+)/)[1];
                            const dev: any = new Sonos(deviceIP);
                            await dev.joinGroup(this.name);
                        }
                    }
                    action.finish();
                    break;
            }
        }
        catch (e) {
            this.assumeDisconnected();
        }
    }

    assumeDisconnected() {
        this.adapter.removeThing(this);
        this.adapter.startPairing(60);
    }
}
