'use strict';

const Property = require('./property');

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
    if(!shuffle && !repeat) {
        return 'NORMAL';
    }
    else if(shuffle && !repeat) {
        return 'SHUFFLE_NOREPEAT';
    }
    else if(shuffle) {
        return 'SHUFFLE';
    }
    else {
        return 'REPEAT_ALL';
    }
}

class Speaker extends Device {
    constructor(adapter, ip, device) {
        super(adapter, ip);

        this.device = device;
        this.name = ip;
        this.type = Constants.THING_TYPE_UNKNOWN_THING;
        this.properties.set('volume', new Property(this, 'volume', {
            type: 'number',
            unit: 'percent'
        }, 1.0));
        this.properties.set('playing', new Property(this, 'playing', {
            type: 'boolean'
        }, false));
        this.properties.set('shuffle', new Property(this, 'shuffle', {
            type: 'boolean'
        }, false));
        this.properties.set('repeat', new Property(this, 'repeat', {
            type: 'boolean'
        }, false));

        //TODO crossfade mode
        //TODO eq
        //TODO loudness
        //TODO repeat one
        //TODO balance for stereo pairs
        //TODO handle fixed volume setting changing
        //TODO actions? Like clear queue, next, prev, stop
        //TODO fields like current track, queue size
        //TODO groups? make it a field?
        //TODO property for queue size/stopped?

        this.ready = this.fetchProperties().then(() => this.adapter.handleDeviceAdded(this));
    }

    async fetchProperties() {
        const name = await this.device.getName();
        this.setName(name);

        const supportsFixedVolume = await this.getSupportsFixedVolume();
        let shouldGetVolume = true;
        if(supportsFixedVolume) {
            const hasFixedVolume = await this.getFixedVolume();
            shouldGetVolume = !hasFixedVolume;
            if(hasFixedVolume) {
                this.properties.delete('volume');
            }
        }
        if(shouldGetVolume) {
            const volume = await this.device.getVolume();
            this.updateProp('volume', volume);
        }

        const state = await this.device.getCurrentState();
        this.updateProp('playing', state === 'playing');

        const mode = await this.device.getPlayMode();
        this.updatePlayMode(mode);

        this.device.on('PlayState', (state) => {
            this.updateProp('playing', state === 'playing');
        });

        this.device.on('PlaybackStopped', () => {
            this.updateProp('playing', false);
        });

        this.device.on('AVTransport', (newValue) => {
            const mode = newValue.CurrentPlayMode;
            this.updatePlayMode(mode);
        });

        if(shouldGetVolume) {
            this.device.on('Volume', (volume) => {
                this.updateProp('volume', volume);
            });
        }
    }

    get renderingControl() {
        if(!this._renderingControl) {
            this._renderingControl = this.device.renderingControlService();
        }
        return this._renderingControl
    }

    async getSupportsFixedVolume() {
        const response = await this.renderingControl._request('GetSupportsOutputFixed', {InstanceID: 0});
        return response.CurrentSupportsFixed != '0';
    }

    async getFixedVolume() {
        const response = await this.renderingControl._request('GetOutputFixed', {InstanceID: 0});
        return response.CurrentFixed != '0';
    }

    updatePlayMode(mode) {
        this.updateProp('shuffle', mode && mode.startsWith('SHUFFLE'));
        this.updateProp('repeat', mode === 'REPEAT_ALL' || mode === 'SHUFFLE');
    }

    updateProp(propertyName, value) {
        const property= this.properties.get(propertyName);
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
        }
        super.notifyPropertyChanged(property);
    }
}
module.exports = Speaker;
