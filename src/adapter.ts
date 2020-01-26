/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import { Adapter, Database } from 'gateway-addon';
import { DeviceDiscovery, Sonos, Discovery } from 'sonos';
import { Speaker } from './speaker';

//TODO cache state

export class SonosAdapter extends Adapter {
    private deviceDiscovery?: Discovery;

    constructor(addonManager: any, private packageName: any) {
        super(addonManager, 'SonosAdapter', packageName);
        addonManager.addAdapter(this);
        this.init();
    }

    private async init() {
        const db = new Database(this.packageName);
        await db.open();
        const config = await db.loadConfig();

        if (config && config.addresses) {
            for (const addr of config.addresses) {
                const device = new Sonos(addr);
                try {
                    await this.addDevice(device);
                } catch (e) {
                    console.warn(e);
                }
            }
        }

        db.close();
        this.discover(20000);
    }

    private discover(timeout: number) {
        return DeviceDiscovery({
            timeout
        }, async (device: any) => {
            try {
                await this.addDevice(device);
            } catch (e) {
                console.warn(e);
            }
        });
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device: any) {
        const deviceDescription = await device.deviceDescription();
        if (deviceDescription.serialNum in this.devices) {
            throw 'Device: ' + deviceDescription.serialNum + ' already exists.';
        }
        else {
            // Don't try to add BRIDGEs
            //TODO should also avoid adding BOOSTs
            if (deviceDescription.zoneType != '4') {
                const speaker = new Speaker(this, deviceDescription.serialNum, device);
                return speaker.ready;
            }
        }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    */
    removeDevice(deviceId: string) {
        const device = this.devices[deviceId];
        if (device) {
            this.handleDeviceRemoved(device);
        }
        else {
            throw new Error('Device: ' + deviceId + ' not found.');
        }
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds: number) {
        this.deviceDiscovery = this.discover(_timeoutSeconds * 1000);
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        try {
            this.deviceDiscovery?.destroy();
        } catch (e) {
            console.log(`Error on stopping device discovery: ${e}`)
        }
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device: any) {
        try {
            this.removeDevice(device.id);
            console.log('SonosAdapter: device:', device.id, 'was unpaired.');
        }
        catch (err) {
            console.error('SonosAdapter: unpairing', device.id, 'failed');
            console.error(err);
        }
    }

    /**
    * Cancel unpairing process.
    *
    * @param {Object} device Device that is currently being paired
    */
    cancelRemoveThing(_device: any) {
    }
}
