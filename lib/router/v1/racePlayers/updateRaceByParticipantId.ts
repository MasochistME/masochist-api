import { Request, Response } from 'express';
import { Race, RacePlayer } from '@masochistme/sdk/dist/v1/types';

import { log } from 'helpers/log';
import { connectToDb } from 'helpers/db';

export const updateRaceByParticipantId = async (
  req: Request<any, Partial<Omit<Race, '_id'>>>,
  res: Response,
): Promise<void> => {
  try {
    const { client, db } = await connectToDb();
    const collection = db.collection<RacePlayer>('racePlayers');
    const { raceId, participantId: discordId } = req.params;

    const racePlayer: RacePlayer | null = await collection.findOne({
      raceId,
      discordId,
    });

    if (!racePlayer) {
      res.status(404).send({ error: 'Could not find the user to update.' });
      return;
    }

    const { startTime, endTime, score, dnf } = req.body; // TODO add validation

    const response = await collection.updateOne(
      { _id: racePlayer._id },
      {
        $set: {
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
          ...(score && { score: Number(score) }),
          ...(dnf && { dnf }),
        },
      },
    );

    client.close();

    if (!response.acknowledged) {
      res.status(400).send({ error: 'Could not update the user.' });
    } else {
      res.status(200).send(response);
    }
  } catch (err: any) {
    log.WARN(err);
    res.status(500).send({ error: err.message ?? 'Internal server error' });
  }
};