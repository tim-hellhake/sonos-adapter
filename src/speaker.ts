/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

import {Sonos, SpotifyRegion} from 'sonos';
import {Device, Adapter, Action} from 'gateway-addon';
import {Action as ActionSchema} from 'gateway-addon/lib/schema';
import {VolumeProperty} from './properties/volume-property';
import {AlbumArtProperty} from './properties/album-art-property';
import {PlayingProperty} from './properties/playing-property';
import {ShuffleProperty} from './properties/shuffle-property';
import {RepeatProperty} from './properties/repeat-property';
import {ProgressProperty} from './properties/progress-property';
import {MutedProperty} from './properties/muted-property';
import {CrossfadeProperty} from './properties/crossfade-property';
import {TrackProperty} from './properties/track-property';
import {ArtistProperty} from './properties/artist-property';
import {RepeatShuffleController} from './properties/repeat-shuffle-controller';

export class Speaker extends Device {
    private volumeProperty: VolumeProperty;

    private playingProperty: PlayingProperty;

    private repeatShuffleController: RepeatShuffleController;

    private shuffleProperty: ShuffleProperty;

    private repeatProperty: RepeatProperty;

    private crossfadeProperty?: CrossfadeProperty;

    private trackProperty?: TrackProperty;

    private albumProperty?: VolumeProperty;

    private artistProperty?: ArtistProperty;

    private progressProperty: ProgressProperty;

    private albumArtProperty?: AlbumArtProperty;

    private mutedProperty: MutedProperty;

    // eslint-disable-next-line max-len
    constructor(adapter: Adapter, id: string, private device: Sonos, private config: unknown) {
      super(adapter, id);

      (this as unknown as {'@type': string[]})['@type'].push('OnOffSwitch');

      this.setTitle(device.host);

      const {
        crossfade,
        track,
        album,
        artist,
        albumArt,
      } = (<{features: Record<string, boolean>}>config).features;

      this.volumeProperty = new VolumeProperty(this, device);
      this.addProperty(this.volumeProperty);

      this.playingProperty = new PlayingProperty(this, device);
      this.addProperty(this.playingProperty);

      this.repeatShuffleController = new RepeatShuffleController(device);

      this.shuffleProperty = new ShuffleProperty(this,
                                                 this.repeatShuffleController);
      this.addProperty(this.shuffleProperty);

      this.repeatProperty = new RepeatProperty(this,
                                               this.repeatShuffleController);
      this.addProperty(this.repeatProperty);

      if (crossfade) {
        this.crossfadeProperty = new CrossfadeProperty(this, device);
        this.addProperty(this.crossfadeProperty);
      }
      if (track) {
        this.trackProperty = new TrackProperty(this, device);
        this.addProperty(this.trackProperty);
      }
      if (album) {
        this.albumProperty = new VolumeProperty(this, device);
        this.addProperty(this.albumProperty);
      }
      if (artist) {
        this.artistProperty = new ArtistProperty(this, device);
        this.addProperty(this.artistProperty);
      }
      this.progressProperty = new ProgressProperty(this, device);
      this.addProperty(this.progressProperty);
      if (albumArt) {
        this.albumArtProperty = new AlbumArtProperty(this, device, adapter);
        this.addProperty(this.albumArtProperty);
      }
      this.mutedProperty = new MutedProperty(this, device);
      this.addProperty(this.mutedProperty);

      // TODO eq
      // TODO loudness
      // TODO balance for stereo pairs
      // TODO actions? Like clear queue, stop
      // TODO fields like current track (album art), queue size
      // TODO queue track position property
      // TODO property for queue size/stopped?
      // TODO playback state when grouped
      // TODO play line-in
      // TODO action to play notification
      // (needs file input and has a toggle for where to play)
      // Useful list of things:
      // https://github.com/SoCo/SoCo/wiki/Sonos-UPnP-Services-and-Functions

      this.addAction('next', {
        title: 'Next',
        // eslint-disable-next-line max-len
        description: 'Skip current track and start playing next track in the queue',
      });
      this.addAction('prev', {
        title: 'Previous',
        description: 'Play previous track in the queue',
      });
      this.addAction('stop', {
        title: 'Stop',
        description: 'Stop current playback',
      });
      this.addAction('playUri', {
        title: 'Play URI',
        description: 'Play the music from the given URI',
        input: {
          type: 'object',
          properties: {
            uri: {
              type: 'string',
            },
          },
        },
      });
    }

    async init(): Promise<void> {
      const {
        group,
      } = (<{features: Record<string, boolean>}> this.config).features;

      const name = await this.device.getName();
      this.setTitle(name);
      console.log(`New title is ${name}`);

      await this.volumeProperty.init();

      await this.mutedProperty.init();

      await this.playingProperty.init();

      await this.trackProperty?.init();

      await this.artistProperty?.init();

      await this.albumProperty?.init();

      await this.progressProperty?.init();

      await this.trackProperty?.init();

      await this.repeatProperty.init();

      await this.shuffleProperty.init();

      await this.crossfadeProperty?.init();

      if (group) {
        const groups = await this.device.getAllGroups();
        const req: string[] = [];
        const props: Record<string, unknown> = {};

        const playerInfo = await this.device.getZoneInfo();
        const groupId = `RINCON_${playerInfo.MACAddress.replace(/:/g, '')}`;
        for (const zone of groups) {
          if (!zone.ID.startsWith(groupId)) {
          // eslint-disable-next-line max-len
            const zoneCoordinator = zone.ZoneGroupMember.find((m) => m.UUID === zone.Coordinator);
            if (zoneCoordinator && zoneCoordinator.Invisible != '1') {
              props[zoneCoordinator.ZoneName] = {
                type: 'boolean',
                // eslint-disable-next-line max-len
                default: zone.ZoneGroupMember.some((m) => m.UUID.startsWith(groupId)),
              };
              req.push(zoneCoordinator.ZoneName);
            }
          }
        }

        const groupDetails: ActionSchema = {
          title: 'Group/Ungroup',
          description: 'Group Sonos players',
          input: {
            type: 'object',
            required: req,
            properties: props,
          },
        };

        this.addAction('group', groupDetails);
      }

      console.log('Initialized device');
    }

    async performAction(action: Action): Promise<void> {
      const description = action.asDict();
      try {
        switch (description.name) {
          case 'next':
            action.start();
            await this.device.next();
            action.finish();
            break;
          case 'prev':
            action.start();
            await this.device.previous();
            action.finish();
            break;
          case 'stop':
            action.start();
            await this.device.stop();
            action.finish();
            break;
          case 'group': {
            action.start();
            // eslint-disable-next-line max-len
            // TODO only execute if the new group config is different from the current one.
            await this.device.leaveGroup();
            const topo = await this.device.getAllGroups();
            // eslint-disable-next-line max-len
            const topoCoordinators = topo.map((z) => z.ZoneGroupMember.find((m) => m.UUID === z.Coordinator));
            const inputs = description.input as Record<string, unknown>;
            for (const input in inputs) {
              if (inputs[input]) {
              // eslint-disable-next-line max-len
                const deviceInfo = topoCoordinators.find((z) => z?.ZoneName?.toLowerCase() == input.toLowerCase());

                if (deviceInfo) {
                // eslint-disable-next-line max-len
                  const deviceIP = (deviceInfo.Location.match(/^http:\/\/([^:]+)/) ?? [])[1];
                  const dev: Sonos = new Sonos(deviceIP);
                  await dev.joinGroup(this.getTitle());
                }
              }
            }
            action.finish();
            break;
          }
          case 'playUri': {
            action.start();
            const input = description.input as Record<string, string>;
            if (input.uri) {
              try {
                const {
                  spotifyRegion,
                } = (<Record<string, SpotifyRegion>> this.config);

                const region = SpotifyRegion[spotifyRegion] || SpotifyRegion.EU;
                this.device.setSpotifyRegion(region);
                await this.device.play(input.uri);
              } catch (e) {
                console.log(`Could not play uri: ${e}`);
              }
            } else {
              console.log('Parameter uri is missing for action playUri');
            }
            action.finish();
          }
        }
      } catch (e) {
        this.assumeDisconnected();
      }
    }

    assumeDisconnected(): void {
      this.getAdapter().removeThing(this);
      this.getAdapter().startPairing(60);
    }
}
