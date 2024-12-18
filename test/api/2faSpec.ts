/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import config from 'config'
import jwt from 'jsonwebtoken'
const Joi = frisby.Joi
const security = require('../../lib/insecurity')

const otplib = require('otplib')

const REST_URL = 'http://localhost:3000/rest'
const API_URL = 'http://localhost:3000/api'

const jsonHeader = { 'content-type': 'application/json' }

async function login ({ email, password, totpSecret }: { email: string, password: string, totpSecret?: string }) {
  const loginRes = await frisby
    .post(REST_URL + '/user/login', { email, password })
    .catch((res: any) => {
      if (res.json?.type && res.json.status === 'totp_token_required') {
        return res
      }
      throw new Error(`Failed to login '${email}'`)
    })

  if (loginRes.json.status && loginRes.json.status === 'totp_token_required') {
    const totpRes = await frisby
      .post(REST_URL + '/2fa/verify', {
        tmpToken: loginRes.json.data.tmpToken,
        totpToken: otplib.authenticator.generate(totpSecret)
      })

    return totpRes.json.authentication
  }

  return loginRes.json.authentication
}

async function register ({ email, password, totpSecret }: { email: string, password: string, totpSecret?: string }) {
  const res = await frisby
    .post(API_URL + '/Users/', {
      email,
      password,
      passwordRepeat: password,
      securityQuestion: null,
      securityAnswer: null
    })
    .catch(() => {
      throw new Error(`Failed to register '${email}'`)
    })

  if (totpSecret) {
    const { token } = await login({ email, password })
    await setup2FA(token, password, totpSecret)
  }

  return res
}

async function setup2FA (token: string, password: string, secret: string) {
  await frisby.post(
    REST_URL + '/2fa/setup',
    {
      headers: {
        Authorization: 'Bearer ' + token,
        'content-type': 'application/json'
      },
      body: {
        password,
        setupToken: security.authorize({
          secret,
          type: 'totp_setup_secret'
        }),
        initialToken: otplib.authenticator.generate(secret)
      }
    }
  ).expect('status', 200)
}

async function disable2FA (token: string, password: string) {
  await frisby.post(
    REST_URL + '/2fa/disable',
    {
      headers: {
        Authorization: 'Bearer ' + token,
        'content-type': 'application/json'
      },
      body: { password }
    }
  ).expect('status', 200)
}

function getStatus (token: string) {
  return frisby.get(
    REST_URL + '/2fa/status',
    {
      headers: {
        Authorization: 'Bearer ' + token,
        'content-type': 'application/json'
      }
    }
  )
}

describe('/rest/2fa/verify', () => {
  it('POST should return a valid authentication when a valid tmp token is passed', async () => {
    const tmpTokenWurstbrot = security.authorize({
      userId: 10,
      type: 'password_valid_needs_second_factor_token'
    })

    const totpToken = otplib.authenticator.generate('IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH')

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: {
        tmpToken: tmpTokenWurstbrot,
        totpToken
      }
    })
      .expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .expect('jsonTypes', 'authentication', {
        token: Joi.string(),
        umail: Joi.string(),
        bid: Joi.number()
      })
      .expect('json', 'authentication', {
        umail: `wurstbrot@${config.get<string>('application.domain')}`
      })
  })

  it('POST should fail if an invalid totp token is used', async () => {
    const tmpTokenWurstbrot = security.authorize({
      userId: 10,
      type: 'password_valid_needs_second_factor_token'
    })

    const totpToken = otplib.authenticator.generate('THIS9ISNT8THE8RIGHT8SECRET')

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: {
        tmpToken: tmpTokenWurstbrot,
        totpToken
      }
    }).expect('status', 401)
  })

  it('POST should fail if an unsigned tmp token is used', async () => {
    const tmpTokenWurstbrot = jwt.sign({
      userId: 10,
      type: 'password_valid_needs_second_factor_token'
    }, 'this_surly_isnt_the_right_key')

    const totpToken = otplib.authenticator.generate('IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH')

    await frisby.post(REST_URL + '/2fa/verify', {
      headers: jsonHeader,
      body: {
        tmpToken: tmpTokenWurstbrot,
        totpToken
      }
    }).expect('status', 401)
  })
})

describe('/rest/2fa/status', () => {
  it('GET should indicate 2fa is setup for 2fa enabled users', async () => {
    const { token } = await login({
      email: `wurstbrot@${config.get<string>('application.domain')}`,
      password: 'EinBelegtesBrotMitSchinkenSCHINKEN!',
      totpSecret: 'IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH'
    })

    await getStatus(token)
      .expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .expect('jsonTypes', { setup: Joi.boolean() })
      .expect('json', { setup: true })
  })

  it('GET should indicate 2fa is not setup for users with 2fa disabled', async () => {
    const { token } = await login({
      email: `J12934@${config.get<string>('application.domain')}`,
      password: '0Y8rMnww$*9VFYE§59-!Fg1L6t&6lB'
    })

    await getStatus(token)
      .expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .expect('jsonTypes', {
        setup: Joi.boolean(),
        secret: Joi.string(),
        email: Joi.string(),
        setupToken: Joi.string()
      })
      .expect('json', {
        setup: false,
        email: `J12934@${config.get<string>('application.domain')}`
      })
  })

  it('GET should return 401 when not logged in', async () => {
    await frisby.get(REST_URL + '/2fa/status').expect('status', 401)
  })
})

describe('/rest/2fa/setup', () => {
  it('POST should be able to setup 2fa for accounts without 2fa enabled', async () => {
    const email = 'fooooo1@bar.com'
    const password = '123456'
    const secret = 'ASDVAJSDUASZGDIADBJS'

    await register({ email, password })
    const { token } = await login({ email, password })

    await setup2FA(token, password, secret)

    await getStatus(token)
      .expect('status', 200)
      .expect('jsonTypes', { setup: Joi.boolean() })
      .expect('json', { setup: true })
  })

  it('POST should fail if the password doesn’t match', async () => {
    const email = 'fooooo2@bar.com'
    const password = '123456'
    const secret = 'ASDVAJSDUASZGDIADBJS'

    await register({ email, password })
    const { token } = await login({ email, password })

    await frisby.post(
      REST_URL + '/2fa/setup',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: {
          password: password + ' this makes the password wrong',
          setupToken: security.authorize({
            secret,
            type: 'totp_setup_secret'
          }),
          initialToken: otplib.authenticator.generate(secret)
        }
      }
    ).expect('status', 401)
  })

  it('POST should fail if the initial token is incorrect', async () => {
    const email = 'fooooo3@bar.com'
    const password = '123456'
    const secret = 'ASDVAJSDUASZGDIADBJS'

    await register({ email, password })
    const { token } = await login({ email, password })

    await frisby.post(
      REST_URL + '/2fa/setup',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: {
          password,
          setupToken: security.authorize({
            secret,
            type: 'totp_setup_secret'
          }),
          initialToken: otplib.authenticator.generate(secret + 'ASJDVASGDKASVDUAGS')
        }
      }
    ).expect('status', 401)
  })

  it('POST should fail if the token is of the wrong type', async () => {
    const email = 'fooooo4@bar.com'
    const password = '123456'
    const secret = 'ASDVAJSDUASZGDIADBJS'

    await register({ email, password })
    const { token } = await login({ email, password })

    await frisby.post(
      REST_URL + '/2fa/setup',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: {
          password,
          setupToken: security.authorize({
            secret,
            type: 'totp_setup_secret_foobar'
          }),
          initialToken: otplib.authenticator.generate(secret)
        }
      }
    ).expect('status', 401)
  })

  it('POST should fail if the account has already set up 2fa', async () => {
    const email = `wurstbrot@${config.get<string>('application.domain')}`
    const password = 'EinBelegtesBrotMitSchinkenSCHINKEN!'
    const totpSecret = 'IFTXE3SPOEYVURT2MRYGI52TKJ4HC3KH'

    const { token } = await login({ email, password, totpSecret })

    await frisby.post(
      REST_URL + '/2fa/setup',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: {
          password,
          setupToken: security.authorize({
            secret: totpSecret,
            type: 'totp_setup_secret'
          }),
          initialToken: otplib.authenticator.generate(totpSecret)
        }
      }
    ).expect('status', 401)
  })
})

describe('/rest/2fa/disable', () => {
  it('POST should be able to disable 2fa for accounts with 2fa enabled', async () => {
    const email = 'fooooodisable1@bar.com'
    const password = '123456'
    const totpSecret = 'ASDVAJSDUASZGDIADBJS'

    await register({ email, password, totpSecret })
    const { token } = await login({ email, password, totpSecret })

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: true })

    await disable2FA(token, password)

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: false })
  })

  it('POST should not be possible to disable 2fa without the correct password', async () => {
    const email = 'fooooodisable1@bar.com'
    const password = '123456'
    const totpSecret = 'ASDVAJSDUASZGUASZGDIADBJS'

    await register({ email, password, totpSecret })
    const { token } = await login({ email, password, totpSecret })

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: true })

    await frisby.post(
      REST_URL + '/2fa/disable',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: { password: password + 'incorrect' }
      }
    ).expect('status', 401)

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: true })
  })

  it('POST should fail if 2fa is not enabled on the account', async () => {
    const email = 'fooooodisable2@bar.com'
    const password = '123456'

    await register({ email, password })
    const { token } = await login({ email, password })

    await getStatus(token)
      .expect('status', 200)
      .expect('json', { setup: false })

    await frisby.post(
      REST_URL + '/2fa/disable',
      {
        headers: {
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        },
        body: { password }
      }
    ).expect('status', 401)
  })
})
