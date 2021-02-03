/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Device, Property} from 'gateway-addon';
import {RepeatShuffleController,
  REPEAT_MODES}
  from './repeat-shuffle-controller';

export class RepeatProperty extends Property<REPEAT_MODES> {

  constructor(device: Device,
    // eslint-disable-next-line no-unused-vars
    private repeatShuffleController: RepeatShuffleController) {
    super(device, 'repeat', {
      title: 'Repeat',
      type: 'string',
      '@type': 'EnumProperty',
      enum: [
        'None',
        'One',
        'All',
      ],
    });

    this.repeatShuffleController.on(
      'repeat',
      (repeat) => this.setCachedValueAndNotify(repeat));
  }

  async init(): Promise<void> {
    await this.repeatShuffleController.init();
  }

  async setValue(value: REPEAT_MODES): Promise<REPEAT_MODES> {
    this.repeatShuffleController.setRepeat(value);
    return super.setValue(value);
  }
}
