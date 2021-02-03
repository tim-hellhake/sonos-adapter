/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import {Adapter, AddonManagerProxy, Database, Device} from 'gateway-addon';
import {DeviceDiscovery, Sonos, Discovery} from 'sonos';
import {Speaker} from './speaker';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const manifest = require('../manifest.json');

// TODO cache state

export class SonosAdapter extends Adapter {
    private deviceDiscovery?: Discovery;

    constructor(addonManager: AddonManagerProxy) {
      super(addonManager, 'SonosAdapter', manifest.id);
      addonManager.addAdapter(this);
      this.init();
    }

    private async readConfig() {
      const db = new Database(manifest.id, '');
      await db.open();
      const config = {...manifest.options.default, ...await db.loadConfig()};
      db.saveConfig(config);
      db.close();
      return config;
    }

    private async init() {
      const config = await this.readConfig();

      if (config && config.addresses) {
        for (const addr of config.addresses) {
          const device = new Sonos(addr);
          try {
            await this.addDevice(device, config);
          } catch (e) {
            console.warn(e);
          }
        }
      }

      this.discover(20000, config);
    }

    private discover(timeout: number, config: unknown): Discovery {
      console.log('Starting discovery');

      return DeviceDiscovery({
        timeout,
      }, async (device) => {
        try {
          await this.addDevice(device, config);
        } catch (e) {
          console.warn(e);
        }
      });
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device: Sonos, config: unknown): Promise<void> {
      console.log(`Found new device ${JSON.stringify(device)}`);
      const deviceDescription = await device.deviceDescription();
      if (deviceDescription.serialNum in this.getDevices()) {
        throw `Device: ${deviceDescription.serialNum} already exists.`;
      } else {
        // Don't try to add BRIDGEs
        // TODO should also avoid adding BOOSTs
        if (deviceDescription.zoneType != '4') {
          // eslint-disable-next-line max-len
          const speaker = new Speaker(this, deviceDescription.serialNum, device, config);
          await speaker.init();
          this.handleDeviceAdded(speaker);
        }

        return Promise.resolve();
      }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    */
    removeDevice(deviceId: string): void {
      const device = this.getDevices()[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
      } else {
        throw new Error(`Device: ${deviceId} not found.`);
      }
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    async startPairing(_timeoutSeconds: number): Promise<void> {
      const config = await this.readConfig();
      this.deviceDiscovery = this.discover(_timeoutSeconds * 1000, config);
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing(): void {
      try {
        this.deviceDiscovery?.destroy();
      } catch (e) {
        console.log(`Error on stopping device discovery: ${e}`);
      }
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device: Device): void {
      try {
        this.removeDevice(device.getId());
        console.log('SonosAdapter: device:', device.getId(), 'was unpaired.');
      } catch (err) {
        console.error('SonosAdapter: unpairing', device.getId(), 'failed');
        console.error(err);
      }
    }
}
