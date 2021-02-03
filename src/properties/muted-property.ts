/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class MutedProperty extends Property<boolean> {

  constructor(device: Device, private sonos: Sonos) {
    super(device, 'muted', {
      title: 'Muted',
      type: 'boolean',
      '@type': 'BooleanProperty',
    });

    sonos.on('Muted', (muted) => {
      this.setCachedValueAndNotify(muted);
    });
  }

  async init(): Promise<void> {
    const muted = await this.sonos.getMuted();
    this.setCachedValueAndNotify(muted);
  }

  async setValue(value: boolean): Promise<boolean> {
    await this.sonos.setMuted(value);
    return super.setValue(value);
  }
}
