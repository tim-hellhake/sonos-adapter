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

    async setValue(value) {
        if(value !== this.value) {
            this.setCachedValue(value);
            await this.device.notifyPropertyChanged(this);
        }
        return this.value;
    }
}

module.exports = SonosProperty;
