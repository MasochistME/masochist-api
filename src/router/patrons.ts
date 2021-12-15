import axios from 'axios';

import { log } from 'helpers/log';
import { connectToDb } from 'helpers/db';

/**
 * Returns all patrons no matter the tier.
 */
export const getAllPatrons = async (req, res) => {
  const { client, db } = await connectToDb();

  db.collection('patreonTiers')
    .find({})
    .toArray((err, tiers) => {
      if (err) {
        log.WARN(err);
        res.status(err.code).send(err);
      } else {
        db.collection('patrons')
          .find({})
          .toArray((err, patrons) => {
            if (err) {
              log.WARN(err);
              res.status(err.code).send(err);
            } else {
              tiers
                .map(
                  tier =>
                    (tier.list = patrons.filter(
                      patron => patron.tier === tier.tier,
                    )),
                )
                .map(
                  patron =>
                    (patron = {
                      steamid: patron.steamid,
                      name: patron.name,
                      avatar: patron.avatar,
                    }),
                );
              res.status(200).send(tiers);
            }
            client.close();
          });
      }
    });
};

/**
 * Returns all patrons from particular tier.
 * @param req.params.tier
 */
export const getPatronsByTier = async (req, res) => {
  const { client, db } = await connectToDb();

  db.collection('patrons')
    .find({ tier: req.params.tier })
    .toArray((err, tier) => {
      if (err) {
        log.WARN(err);
        res.status(err.code).send(err);
      } else if (!tier) {
        res.sendStatus(404);
      } else {
        res.status(200).send(tier);
      }
      client.close();
    });
};

/**
 * Returns a patron by their steam ID.
 * @param req.params.steamid
 */
export const getPatron = async (req, res) => {
  const { client, db } = await connectToDb();

  db.collection('patrons').findOne(
    { steamid: req.params.steamid },
    (err, tier) => {
      if (err) {
        log.WARN(err);
        res.status(err.code).send(err);
      } else if (!tier) {
        res.sendStatus(404);
      } else {
        res.status(200).send(tier);
      }
      client.close();
    },
  );
};

/**
 * Adds a patron.
 * @param req.params.tier
 * @param req.params.vanityid
 */
export const addPatron = async (req, res) => {
  const { client, db } = await connectToDb();
  const urlVanity =
    'http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001';
  const paramsVanity = {
    key: process.env.STEAM_KEY,
    vanityurl: req.params.vanityid,
  };
  const userVanity = await axios.get(urlVanity, { params: paramsVanity }); // TODO add trycatch

  const urlSummary =
    'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002';
  const paramsSummary = {
    key: process.env.STEAM_KEY,
    steamids: userVanity.data.response.steamid,
  };
  const userSummary = await axios.get(urlSummary, { params: paramsSummary }); // TODO add trycatch
  const patron = {
    steamid: userVanity.data.response.steamid,
    name: userSummary.data.response.players[0].name || req.params.vanityid,
    avatar:
      userSummary.data.response.players[0].avatarfull ||
      'https://image.flaticon.com/icons/svg/37/37943.svg',
    tier: req.params.tier,
  };

  db.collection('patrons').insertOne(patron, err => {
    if (err) {
      log.WARN(err);
      res.status(err.code).send(err);
    } else {
      log.INFO(
        `Patron ${
          userSummary.data.response.players[0].name || req.params.vanityid
        } added.`,
      );
      res.status(201).send(patron);
    }
    client.close();
  });
};

/**
 * Updates a patron.
 * @param req.params.steamid
 * @param req.params.tier
 */
export const updatePatron = async (req, res) => {
  const { client, db } = await connectToDb();
  const urlSummary = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_KEY}&steamids=${req.params.steamid}`;
  let userSummary;
  try {
    userSummary = await axios.get(urlSummary);
  } catch (err) {
    log.WARN(urlSummary);
    log.WARN(err);
    return;
  }

  const patron = {
    steamid: req.params.steamid,
    name:
      userSummary.data.response.players[0].personaname ||
      userSummary.data.response.players[0].name ||
      'unknown',
    avatar:
      userSummary.data.response.players[0].avatarfull ||
      'https://image.flaticon.com/icons/svg/37/37943.svg',
    tier: req.params.tier,
  };

  db.collection('patrons').updateOne(
    { steamid: req.params.steamid },
    { $set: patron },
    err => {
      if (err) {
        log.WARN(err);
        res.status(err.code).send(err);
      } else {
        log.INFO(
          `Patron ${
            userSummary.data.response.players[0].name || req.params.steamid
          } updated.`,
        );
        res.status(201).send(patron);
      }
      client.close();
    },
  );
};

/**
 * Deletes a patron.
 * @param req.params.steamid
 */
export const deletePatron = async (req, res) => {
  const { client, db } = await connectToDb();

  db.collection('patrons').deleteOne(
    { steamid: req.params.steamid },
    (err, patron) => {
      if (err) {
        log.WARN(err);
        res.status(err.code).send(err);
      } else if (!patron) {
        res.sendStatus(404);
      } else {
        log.INFO(`Patron ${req.params.steamid} deleted.`);
        res.sendStatus(204);
      }
      client.close();
    },
  );
};
