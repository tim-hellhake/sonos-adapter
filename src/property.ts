/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
