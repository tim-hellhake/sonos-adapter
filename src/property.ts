'use strict';

import { Property, Device } from 'gateway-addon';

export class SonosProperty extends Property {
    constructor(device: Device, name: string, description: any, value: any) {
        super(device, name, description);
        this.setCachedValue(value);
    }

    async setValue(value: any) {
        if (value !== this.value) {
            this.setCachedValue(value);
            await this.device.notifyPropertyChanged(this);
        }
        return this.value;
    }
}
