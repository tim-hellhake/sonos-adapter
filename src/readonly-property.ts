'use strict';

import { Property, Device } from 'gateway-addon';

export class ReadonlyProperty extends Property {
    constructor(device: Device, name: string, description: any) {
        description.readOnly = true;
        super(device, name, description);
    }

    setValue(_value: any) {
        return Promise.reject("Read only property");
    }
}
