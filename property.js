'use strict';

let Property;
try {
    Property = require('../property');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Property = gwa.Property;
}

class SonosProperty extends Property {
    constructor(device, name, description, value) {
        super(device, name, description);
        this.setCachedValue(value);
    }

    setValue(value) {
        if(value !== this.value) {
            this.setCachedValue(value);
            this.device.notifyPropertyChanged(this);
            //TODO actually wait for the state change here?
        }
        return Promise.resolve(this.value);
    }
}

module.exports = SonosProperty;
