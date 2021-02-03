/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class VolumeProperty extends Property<number> {
    private supportsFixed = false;

    constructor(device: Device, private sonos: Sonos) {
      super(device, 'volume', {
        title: 'Volume',
        type: 'integer',
        unit: 'percent',
        '@type': 'LevelProperty',
      });

      sonos.on('Volume', (volume) => {
        this.setCachedValueAndNotify(volume);
      });
    }

    async init(): Promise<void> {
      this.supportsFixed = await this.supportsFixedVolume();
      this.setReadOnly(await this.isFixedVolume());
      const volume = await this.sonos.getVolume();
      this.setCachedValueAndNotify(volume);
    }

    async supportsFixedVolume(): Promise<boolean> {
    // eslint-disable-next-line max-len
      const renderingControl = this.sonos.renderingControlService();
      // eslint-disable-next-line max-len
      const supportsResponse = await renderingControl._request('GetSupportsOutputFixed', {InstanceID: 0});
      return supportsResponse.CurrentSupportsFixed != '0';
    }

    async isFixedVolume(): Promise<boolean> {
      if (this.supportsFixed) {
      // eslint-disable-next-line max-len
        const renderingControl = this.sonos.renderingControlService();
        // eslint-disable-next-line max-len
        const response = await renderingControl._request('GetOutputFixed', {InstanceID: 0});
        return response.CurrentFixed != '0';
      }

      return false;
    }

    async setValue(value: number): Promise<number> {
      this.sonos.setVolume(value);
      return super.setValue(value);
    }
}
