/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {EventEmitter} from 'events';
import {Sonos} from 'sonos';

export declare interface RepeatShuffleController {
    // eslint-disable-next-line no-unused-vars
    on(event: 'repeat', listener: (repeat: REPEAT_MODES) => void): this;
    // eslint-disable-next-line no-unused-vars
    on(event: 'shuffle', listener: (shuffle: boolean) => void): this;
}

export type REPEAT_MODES = 'None' | 'One' | 'All';

export class RepeatShuffleController extends EventEmitter {

    private repeat: REPEAT_MODES = 'None';

    private shuffle = false;

    // eslint-disable-next-line no-unused-vars
    constructor(private sonos: Sonos) {
      super();
      this.sonos.on('AVTransport', (newValue) => {
        const mode = newValue.CurrentPlayMode;
        this.update(mode);
        this.emit('repeat', this.repeat);
        this.emit('shuffle', this.shuffle);
      });
    }

    async init(): Promise<void> {
      const mode = await this.sonos.getPlayMode();
      this.update(mode);
    }

    private update(mode: string): void {
      switch (mode) {
        case 'NORMAL':
          this.repeat = 'None';
          this.shuffle = false;
          break;
        case 'REPEAT_ONE':
          this.repeat = 'One';
          this.shuffle = false;
          break;
        case 'REPEAT_ALL':
          this.repeat = 'All';
          this.shuffle = false;
          break;
        case 'SHUFFLE_NOREPEAT':
          this.repeat = 'None';
          this.shuffle = true;
          break;
        case 'SHUFFLE_REPEAT_ONE':
          this.repeat = 'One';
          this.shuffle = true;
          break;
        case 'SHUFFLE':
          this.repeat = 'All';
          this.shuffle = true;
          break;
      }
    }

    public setRepeat(repeat: REPEAT_MODES): void {
      this.repeat = repeat;
      this.sonos.setPlayMode(this.getState());
    }

    public setShuffle(shuffle: boolean): void {
      this.shuffle = shuffle;
      this.sonos.setPlayMode(this.getState());
    }

    private getState() {
      if (this.shuffle) {
        switch (this.repeat) {
          case 'None':
            return 'SHUFFLE_NOREPEAT';
          case 'One':
            return 'SHUFFLE_REPEAT_ONE';
          case 'All':
            return 'SHUFFLE';
        }
      } else {
        switch (this.repeat) {
          case 'None':
            return 'NORMAL';
          case 'One':
            return 'REPEAT_ONE';
          case 'All':
            return 'REPEAT_ALL';
        }
      }
    }
}
