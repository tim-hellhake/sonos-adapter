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
    constructor(adapter, id, device) {
        super(adapter, ip);

        this.device = device;
        this.name = device.getName();
        this.type = Constants.THING_TYPE_UNKNOWN_THING;

        device.getVolume().then((volume) => {
            this.properties.set('volume', new Property(this, 'volume', {
                type: 'number',
                unit: 'percent'
            }, volume));
        }

        device.getCurrentState().then((state) => {
            this.properties.set('playing', new Property(this, 'playing', {
                type: 'boolean'
            }, state === 'playing'));
        });
        //TODO property for queue size/stopped?

        device.getPlayMode().then((mode) => {
            this.properties.set('shuffle', new Property(this, 'shuffle', {
                type: 'boolean'
            }, mode.startsWith('SHUFFLE')));
            this.properties.set('repeat', new Property(this, 'repeat', {
                type: 'boolean'
            }, mode === 'REPEAT_ALL' || mode === 'SHUFFLE'));
        });

        device.on('PlayState', () => {
            device.getCurrentState().then((state) => {
                this.properties.get('playing').setCachedValue(state === 'playing');
            });
        });

        device.on('Volume', () => {
            device.getVolume().then((volume) => {
                this.properties.get('volume').setCachedValue(volume);
            });
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

        this.adapter.handleDeviceAdded(this);
    }

    notifyPropertyChanged(property) {
        super.notifyPropertyChanged(property);

        const newValue = this.properties.get(property.name)
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
