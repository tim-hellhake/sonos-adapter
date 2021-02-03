/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class ArtistProperty extends Property<string> {

  constructor(device: Device, private sonos: Sonos) {
    super(device, 'artist', {
      title: 'Artist',
      type: 'string',
      '@type': 'StringProperty',
    });

    sonos.on('PlaybackStopped', () => {
      this.setCachedValueAndNotify('');
    });

    sonos.on('AVTransport', (newValue) => {
      if (!newValue.CurrentTrackMetaDataParsed) {
        this.setCachedValueAndNotify('');
      }
    });

    sonos.on('CurrentTrack', (currentTrack) => {
      this.setCachedValueAndNotify(currentTrack.artist);
    });
  }

  async init(): Promise<void> {
    const currentTrack = await this.sonos.currentTrack();
    this.setCachedValueAndNotify(currentTrack.artist);
  }

  async setValue(value: string): Promise<string> {
    this.sonos.setVolume(value);
    return super.setValue(value);
  }
}
