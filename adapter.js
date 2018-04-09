'use strict';

const { Sonos, DeviceDiscovery } = require("sonos");

//TODO cache state

let Adapter;
try {
    Adapter = require('../adapter');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Adapter = gwa.Adapter;
}

class ExampleProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
  }

  /**
   * Set the value of the property.
   *
   * @param {*} value The new value to set
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        resolve(updatedValue);
        this.device.notifyPropertyChanged(this);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class ExampleDevice extends Device {
  constructor(adapter, id, deviceDescription) {
    super(adapter, id);
    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this.description = deviceDescription.description;
    for (const propertyName in deviceDescription.properties) {
      const propertyDescription = deviceDescription.properties[propertyName];
      const property = new ExampleProperty(this, propertyName,
                                           propertyDescription);
      this.properties.set(propertyName, property);
    }
  }
}

class SonosAdapter extends Adapter {
    constructor(addonManager, packageName) {
        super(addonManager, 'SonosAdapter', packageName);
        addonManager.addAdapter(this);
    }

    /**
    * @param {String} deviceId ID of the device to add.
    * @param {String} deviceDescription Description of the device to add.
    * @return {Promise} which resolves to the device added.
    */
    addDevice(deviceId, deviceDescription) {
        return new Promise((resolve, reject) => {
            if(deviceId in this.devices) {
                reject('Device: ' + deviceId + ' already exists.');
            }
            else {
                const device = new Speaker(this, deviceId, deviceDescription);
                this.handleDeviceAdded(device);
                resolve(device);
            }
        });
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    * @return {Promise} which resolves to the device removed.
    */
    removeDevice(deviceId) {
        return new Promise((resolve, reject) => {
            const device = this.devices[deviceId];
            if(device) {
                this.handleDeviceRemoved(device);
                resolve(device);
            }
            else {
                reject('Device: ' + deviceId + ' not found.');
            }
        });
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds) {
        this.deviceDiscovery = new DeviceDiscovery((device) => {
            device.host -> IP?
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
        console.log('ExampleAdapter:', this.name, 'id', this.id,
        'removeThing(', device.id, ') started');

        this.removeDevice(device.id).then(() => {
            console.log('ExampleAdapter: device:', device.id, 'was unpaired.');
        }).catch((err) => {
            console.error('ExampleAdapter: unpairing', device.id, 'failed');
            console.error(err);
        });
    }

    /**
    * Cancel unpairing process.
    *
    * @param {Object} device Device that is currently being paired
    */
    cancelRemoveThing(device) {
        console.log('ExampleAdapter:', this.name, 'id', this.id, 'cancelRemoveThing(', device.id, ')');
    }
}

function loadExampleAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new SonosAdapter(addonManager, manifest.name);
  const device = new ExampleDevice(adapter, 'example-plug-2', {
    name: 'example-plug-2',
    type: 'onOffSwitch',
    description: 'Example Device',
    properties: {
      on: {
        name: 'on',
        type: 'boolean',
        value: false,
      },
    },
  });
  adapter.handleDeviceAdded(device);
}

module.exports = loadExampleAdapter;
