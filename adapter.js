'use strict';

const { Adapter } = require('gateway-addon');
const { DeviceDiscovery } = require("sonos");
const Speaker = require("./speaker");

//TODO cache state

class SonosAdapter extends Adapter {
    constructor(addonManager, packageName) {
        super(addonManager, 'SonosAdapter', packageName);
        addonManager.addAdapter(this);

        DeviceDiscovery({
            timeout:  20000
        }, (device) => {
            this.addDevice(device).catch(console.warn);
        });
    }

    /**
    * @param {SonosDevice} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device) {
        const deviceDescription = await device.deviceDescription();
        if(deviceDescription.serialNum in this.devices) {
            throw 'Device: ' + deviceDescription.serialNum + ' already exists.';
        }
        else {
            // Don't try to add BRIDGEs
            //TODO should also avoid adding BOOSTs
            if(deviceDescription.zoneType != '4') {
                const speaker = new Speaker(this, deviceDescription.serialNum, device);
                return speaker.ready;
            }
        }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    */
    removeDevice(deviceId) {
        const device = this.devices[deviceId];
        if(device) {
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
    startPairing(_timeoutSeconds) {
        this.deviceDiscovery = DeviceDiscovery({
            timeout: _timeoutSeconds * 1000
        }, (device) => {
            this.addDevice(device).catch(console.warn);
        });
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        this.deviceDiscovery.destroy();
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device) {
        try {
            this.removeDevice(device.id);
            console.log('SonosAdapter: device:', device.id, 'was unpaired.');
        }
        catch(err) {
            console.error('SonosAdapter: unpairing', device.id, 'failed');
            console.error(err);
        }
    }

    /**
    * Cancel unpairing process.
    *
    * @param {Object} device Device that is currently being paired
    */
    cancelRemoveThing(device) {
    }
}

function loadAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new SonosAdapter(addonManager, manifest.name);
}

module.exports = loadAdapter;
