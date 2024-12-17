/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import config from 'config';
import colors from 'colors/safe';
import { retrieveCodeSnippet } from '../routes/vulnCodeSnippet';
import { readFixes } from '../routes/vulnCodeFixes';
import { type Challenge } from '../data/types';
import { getCodeChallenges } from './codingChallenges';
import logger from './logger';
import { type NextFunction, type Request, type Response } from 'express';
import * as utils from './utils';
// @ts-expect-error FIXME due to non-existing type definitions for median
import median from 'median';

// Define types for challenges and interactions
interface CoupledChallenges {
  [key: string]: string[];
}

interface PreSolveInteraction {
  challengeKey: string;
  urlFragments: string[];
  interactions: boolean[];
}

interface SolveRecord {
  challenge: Challenge;
  phase: string;
  timestamp: Date;
  cheatScore: number;
}

const coupledChallenges: CoupledChallenges = {
  loginAdminChallenge: ['weakPasswordChallenge'],
  nullByteChallenge: ['easterEggLevelOneChallenge', 'forgottenDevBackupChallenge', 'forgottenBackupChallenge', 'misplacedSignatureFileChallenge'],
  deprecatedInterfaceChallenge: ['uploadTypeChallenge', 'xxeFileDisclosureChallenge', 'xxeDosChallenge'],
  uploadSizeChallenge: ['uploadTypeChallenge', 'xxeFileDisclosureChallenge', 'xxeDosChallenge'],
  uploadTypeChallenge: ['uploadSizeChallenge', 'xxeFileDisclosureChallenge', 'xxeDosChallenge'],
};

const trivialChallenges: string[] = ['errorHandlingChallenge', 'privacyPolicyChallenge', 'closeNotificationsChallenge'];

const solves: SolveRecord[] = [{
  challenge: {} as Challenge, // Initial seed with empty challenge
  phase: 'server start',
  timestamp: new Date(),
  cheatScore: 0,
}];

const preSolveInteractions: PreSolveInteraction[] = [
  { challengeKey: 'missingEncodingChallenge', urlFragments: ['/assets/public/images/uploads/%F0%9F%98%BC-'], interactions: [false] },
  { challengeKey: 'directoryListingChallenge', urlFragments: ['/ftp'], interactions: [false] },
  { challengeKey: 'easterEggLevelOneChallenge', urlFragments: ['/ftp', '/ftp/eastere.gg'], interactions: [false, false] },
  { challengeKey: 'easterEggLevelTwoChallenge', urlFragments: ['/ftp', '/gur/qrif/ner/fb/shaal/gurl/uvq/na/rnfgre/rtt/jvguva/gur/rnfgre/rtt'], interactions: [false, false] },
  { challengeKey: 'forgottenDevBackupChallenge', urlFragments: ['/ftp', '/ftp/package.json.bak'], interactions: [false, false] },
  { challengeKey: 'forgottenBackupChallenge', urlFragments: ['/ftp', '/ftp/coupons_2013.md.bak'], interactions: [false, false] },
  { challengeKey: 'loginSupportChallenge', urlFragments: ['/ftp', '/ftp/incident-support.kdbx'], interactions: [false, false] },
  { challengeKey: 'misplacedSignatureFileChallenge', urlFragments: ['/ftp', '/ftp/suspicious_errors.yml'], interactions: [false, false] },
  { challengeKey: 'recChallenge', urlFragments: ['/api-docs', '/b2b/v2/orders'], interactions: [false, false] },
  { challengeKey: 'rceOccupyChallenge', urlFragments: ['/api-docs', '/b2b/v2/orders'], interactions: [false, false] },
];

export const checkForPreSolveInteractions = () => (req: Request, res: Response, next: NextFunction) => {
  const { url } = req;
  preSolveInteractions.forEach((preSolveInteraction) => {
    preSolveInteraction.urlFragments.forEach((fragment, index) => {
      if (utils.endsWith(url, fragment)) {
        preSolveInteraction.interactions[index] = true;
      }
    });
  });
  next();
};

export const calculateCheatScore = (challenge: Challenge): number => {
  const timestamp = new Date();
  let cheatScore = 0;
  let timeFactor = 2;
  timeFactor *= config.get<boolean>('challenges.showHints') ? 1 : 1.5;
  timeFactor *= challenge.tutorialOrder && config.get<boolean>('hackingInstructor.isEnabled') ? 0.5 : 1;

  if (areCoupled(challenge, previous().challenge) || isTrivial(challenge)) {
    timeFactor = 0;
  }

  const minutesExpectedToSolve = challenge.difficulty * timeFactor;
  const minutesSincePreviousSolve = (timestamp.getTime() - previous().timestamp.getTime()) / 60000;
  cheatScore += Math.max(0, 1 - (minutesSincePreviousSolve / minutesExpectedToSolve));

  const preSolveInteraction = preSolveInteractions.find((interaction) => interaction.challengeKey === challenge.key);
  if (preSolveInteraction) {
    const percentPrecedingInteraction = preSolveInteraction.interactions.filter(Boolean).length / preSolveInteraction.interactions.length;
    cheatScore *= 1 + Math.max(0, 1 - percentPrecedingInteraction) / 2;
    cheatScore = Math.min(1, cheatScore);
  }

  logger.info(`Cheat score for ${getChallengeDescription(challenge)}: ${formatCheatScore(cheatScore)}`);
  solves.push({ challenge, phase: 'hack it', timestamp, cheatScore });
  return cheatScore;
};

export const calculateFindItCheatScore = async (challenge: Challenge): Promise<number> => {
  const timestamp = new Date();
  let timeFactor = 0.001;
  timeFactor *= challenge.key === 'scoreBoardChallenge' && config.get<boolean>('hackingInstructor.isEnabled') ? 0.5 : 1;
  let cheatScore = 0;

  const codeSnippet = await retrieveCodeSnippet(challenge.key);
  if (!codeSnippet) return 0;

  const { snippet, vulnLines } = codeSnippet;
  timeFactor *= vulnLines.length;

  if (await checkForIdenticalSolvedChallenge(challenge)) {
    timeFactor *= 0.8;
  }

  const minutesExpectedToSolve = Math.ceil(snippet.length * timeFactor);
  const minutesSincePreviousSolve = (timestamp.getTime() - previous().timestamp.getTime()) / 60000;
  cheatScore += Math.max(0, 1 - (minutesSincePreviousSolve / minutesExpectedToSolve));

  logger.info(`Cheat score for "Find it" phase of ${getChallengeDescription(challenge)}: ${formatCheatScore(cheatScore)}`);
  solves.push({ challenge, phase: 'find it', timestamp, cheatScore });

  return cheatScore;
};

export const calculateFixItCheatScore = async (challenge: Challenge): Promise<number> => {
  const timestamp = new Date();
  let cheatScore = 0;

  const { fixes } = readFixes(challenge.key);
  const minutesExpectedToSolve = Math.floor(fixes.length / 2);
  const minutesSincePreviousSolve = (timestamp.getTime() - previous().timestamp.getTime()) / 60000;
  cheatScore += Math.max(0, 1 - (minutesSincePreviousSolve / minutesExpectedToSolve));

  logger.info(`Cheat score for "Fix it" phase of ${colors.cyan(challenge.key)}: ${formatCheatScore(cheatScore)}`);
  solves.push({ challenge, phase: 'fix it', timestamp, cheatScore });

  return cheatScore;
};

export const totalCheatScore = (): number => {
  return solves.length > 1 ? median(solves.map(({ cheatScore }) => cheatScore)) : 0;
};

function areCoupled(challenge: Challenge, previousChallenge: Challenge): boolean {
  return coupledChallenges[challenge.key]?.includes(previousChallenge.key) || coupledChallenges[previousChallenge.key]?.includes(challenge.key);
}

function isTrivial(challenge: Challenge): boolean {
  return trivialChallenges.includes(challenge.key);
}

function previous(): SolveRecord {
  return solves[solves.length - 1];
}

const checkForIdenticalSolvedChallenge = async (challenge: Challenge): Promise<boolean> => {
  const codingChallenges = await getCodeChallenges();
  if (!codingChallenges.has(challenge.key)) return false;

  const codingChallengesToCompare = codingChallenges.get(challenge.key);
  if (!codingChallengesToCompare?.snippet) return false;

  const snippetToCompare = codingChallengesToCompare.snippet;

  for (const [challengeKey, { snippet }] of codingChallenges.entries()) {
    if (challengeKey === challenge.key) continue; // Don't compare to itself

    if (snippet === snippetToCompare) {
      return solves.some((solvedChallenge) => solvedChallenge.phase === 'find it');
    }
  }
  return false;
};

// Utility functions
function getChallengeDescription(challenge: Challenge): string {
  return `${areCoupled(challenge, previous().challenge) ? 'coupled ' : ''}${isTrivial(challenge) ? 'trivial ' : ''}${challenge.tutorialOrder ? 'tutorial ' : ''}${colors.cyan(challenge.key)}`;
}

function formatCheatScore(cheatScore: number): string {
  if (cheatScore < 0.33) return colors.green(cheatScore.toFixed(2));
  if (cheatScore < 0.66) return colors.yellow(cheatScore.toFixed(2));
  return colors.red(cheatScore.toFixed(2));
}