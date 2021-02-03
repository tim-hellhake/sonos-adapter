/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {Adapter, Device, Property} from 'gateway-addon';
import {Sonos} from 'sonos';

import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import fetch from 'node-fetch';
import output from 'image-output';
import imageType from 'image-type';
import pixels from 'image-pixels';
import jpeg from 'jpeg-js';

export class AlbumArtProperty extends Property<number> {
  private artDir: string;

  constructor(
    // eslint-disable-next-line no-unused-vars
    device: Device, private sonos: Sonos, private adapter: Adapter) {
    super(device, 'albumArt', {
      title: 'Album art',
      '@type': 'ImageProperty',
      type: 'null',
      links: [
        {
          mediaType: 'image/png',
          href: `/media/sonos/${device.getId()}/album.png`,
          rel: 'alternate',
        },
      ],
    });


    this.artDir = path.join(
      this.adapter.getUserProfile()?.mediaDir ?? '',
      'sonos',
      this.getDevice().getId());

    this.sonos.on('CurrentTrack', async (currentTrack) => {
      try {
        await this.updateAlbumArt(currentTrack.albumArtURI);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async init(): Promise<void> {
    const currentTrack = await this.sonos.currentTrack();
    await this.updateAlbumArt(currentTrack.albumArtURL);
  }

  async updateAlbumArt(url: string): Promise<void> {
    await mkdirp(this.artDir);
    const artUrl = path.join(this.artDir, 'album.png');
    let parsed = false;

    try {
      if (url) {
        const response = await fetch(url);
        const blob = await response.buffer();
        const type = imageType(blob);

        if (type) {
          if (type.mime === 'image/png') {
            await new Promise<void>((resolve, reject) => {
              fs.writeFile(artUrl, blob, (e) => {
                if (e) {
                  reject(e);
                } else {
                  resolve();
                }
              });
            });
            parsed = true;
          } else if (type.mime === 'image/jpeg') {
            const imageData = jpeg.decode(blob);
            const px = await pixels(
              blob,
              {
                width: imageData.width,
                height: imageData.height,
              }
            );
            await output(px, artUrl);
            parsed = true;
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }

    if (!parsed) {
      await new Promise<void>((resolve) => {
        if (fs.existsSync(artUrl)) {
          fs.unlink(artUrl, () => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  }

  async setValue(value: number): Promise<number> {
    this.sonos.setVolume(value);
    return super.setValue(value);
  }
}
