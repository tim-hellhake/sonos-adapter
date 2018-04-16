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
        let ready = device.getName().then((name) => this.setName(name)).catch(console.error);
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

        device.getVolume().then((volume) => {
            this.properties.get('volume').setCachedValue(volume);
        }).catch(console.error);

        device.getCurrentState().then((state) => {
            this.properties.get('playing').setCachedValue(state === 'playing');
        }).catch(console.error);
        //TODO property for queue size/stopped?

        device.getPlayMode().then((mode) => {
            this.properties.get('shuffle').setCachedValue(mode && mode.startsWith('SHUFFLE'));
            this.properties.get('repeat').setCachedValue(mode === 'REPEAT_ALL' || mode === 'SHUFFLE');
        }).catch(console.error);

        device.on('PlayState', () => {
            device.getCurrentState().then((state) => {
                this.properties.get('playing').setCachedValue(state === 'playing');
            }).catch(console.error);
        });

        device.on('Volume', () => {
            device.getVolume().then((volume) => {
                this.properties.get('volume').setCachedValue(volume);
            }).catch(console.error);
        });


        //TODO listen for shuffle/repeat changes

        //TODO crossfade mode
        //TODO eq
        //TODO loudness
        //TODO balance for stereo pairs
        //TODO handle fixed volume
        //TODO actions? Like clear queue, next, prev, stop
        //TODO fields like current track, queue size
        //TODO groups? make it a field?

        ready.then(() => this.adapter.handleDeviceAdded(this));
    }

    notifyPropertyChanged(property) {
        super.notifyPropertyChanged(property);

        const newValue = this.properties.get(property.name);
        console.log("uhm");
        switch(property.name) {
            case 'playing':
                if(newValue) {
                    this.device.play();
                }
                else {
                    this.device.pause();
                }
            break;
            case 'volume':
                this.device.setVolume(newValue);
            break;
            case 'shuffle':
            case 'repeat':
                this.device.setPlayMode(
                    getModeFromProps(
                        this.properties.get('shuffle'),
                        this.properties.get('repeat')
                    )
                );
            break;
        }
    }
}
module.exports = Speaker;
