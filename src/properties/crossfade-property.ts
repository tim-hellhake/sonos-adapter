/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class CrossfadeProperty extends Property<boolean> {

  constructor(device: Device, private sonos: Sonos) {
    super(device, 'crossfade', {
      title: 'Crossfade',
      type: 'boolean',
      '@type': 'BooleanProperty',
    });

    sonos.on('AVTransport', (newValue) => {
      this.setCachedValueAndNotify(newValue.CurrentCrossfadeMode != '0');
    });
  }

  async init(): Promise<void> {
    const avTransport = this.sonos.avTransportService();
    const response = await avTransport.GetCrossfadeMode();
    this.setCachedValueAndNotify(response.CurrrentCrossfadeMode != '0');
  }

  async setValue(value: boolean): Promise<boolean> {
    const avTransport = this.sonos.avTransportService();
    // eslint-disable-next-line max-len
    await avTransport.SetCrossfadeMode({InstanceID: 0, CrossfadeMode: value});
    return super.setValue(value);
  }
}
