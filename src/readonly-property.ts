/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import {Property, Device} from 'gateway-addon';

export class ReadonlyProperty extends Property {
  constructor(
    device: Device, name: string, description: Record<string, unknown>) {
    description.readOnly = true;
    super(device, name, description);
  }

  setValue(): Promise<void> {
    return Promise.reject('Read only property');
  }
}
