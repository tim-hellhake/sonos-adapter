/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {RepeatShuffleController} from './repeat-shuffle-controller';

export class ShuffleProperty extends Property<boolean> {

  constructor(device: Device,
    // eslint-disable-next-line no-unused-vars
    private repeatShuffleController: RepeatShuffleController) {
    super(device, 'shuffle', {
      title: 'Shuffle',
      type: 'boolean',
      '@type': 'BooleanProperty',
    });

    this.repeatShuffleController.on(
      'shuffle',
      (shuffle) => this.setCachedValueAndNotify(shuffle));
  }

  async init(): Promise<void> {
    await this.repeatShuffleController.init();
  }

  async setValue(value: boolean): Promise<boolean> {
    this.repeatShuffleController.setShuffle(value);
    return super.setValue(value);
  }
}
