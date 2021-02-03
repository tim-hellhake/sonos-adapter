/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class PlayingProperty extends Property<boolean> {

  constructor(device: Device, private sonos: Sonos) {
    super(device, 'playing', {
      title: 'Playing',
      type: 'boolean',
      '@type': 'BooleanProperty',
    });

    sonos.on('PlaybackStopped', () => {
      this.setCachedValueAndNotify(false);
    });

    sonos.on('PlayState', (state) => {
      const playing = state === 'playing';
      this.setCachedValueAndNotify(playing);
    });
  }

  async init(): Promise<void> {
    const state = await this.sonos.getCurrentState();
    this.setCachedValueAndNotify(state === 'playing');
  }

  async setValue(value: boolean): Promise<boolean> {
    if (value) {
      await this.sonos.play();
    } else {
      await this.sonos.pause();
    }
    return super.setValue(value);
  }
}
