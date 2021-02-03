/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

export class ProgressProperty extends Property<number> {
  private progress = 0;

  private playing = false;

  constructor(device: Device, private sonos: Sonos) {
    super(device, 'progress', {
      title: 'Progress',
      type: 'number',
      '@type': 'LevelProperty',
    });

    this.setMinimum(0);
    this.setMaximum(100);

    setInterval(() => {
      if (this.playing) {
        this.setProgress(this.progress + 1);
      }
    }, 1000);

    sonos.on('PlaybackStopped', () => {
      this.setProgress(0);
      this.playing = false;
    });

    sonos.on('PlayState', (state) => {
      this.playing = state === 'playing';
    });

    sonos.on('CurrentTrack', async (currentTrack) => {
      if (!isNaN(currentTrack.duration && currentTrack.duration)) {
        this.setMaximum(currentTrack.duration);

        if (currentTrack.position) {
          this.setProgress(currentTrack.position);
        } else {
          const currentTrack = await this.sonos.currentTrack();
          this.setProgress(currentTrack.position);
        }
      }
    });
  }

  private setProgress(progress: number) {
    this.progress = progress;
    this.setCachedValueAndNotify(progress);
  }

  async init(): Promise<void> {
    const currentTrack = await this.sonos.currentTrack();

    if (currentTrack.duration) {
      this.setMaximum(currentTrack.duration);
    }
  }

  async setValue(value: number): Promise<number> {
    this.progress = value;
    await this.sonos.seek(value);
    return super.setValue(value);
  }
}
