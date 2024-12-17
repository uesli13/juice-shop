/* 
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */
import { challenges } from '../../data/datacache'
import frisby = require('frisby')
import { expect } from '@jest/globals'
const Joi = frisby.Joi
const utils = require('../../lib/utils')
const security = require('../../lib/insecurity')

const API_URL = 'http://localhost:3000/api'
const REST_URL = 'http://localhost:3000/rest'

const authHeader = { Authorization: 'Bearer ' + security.authorize(), 'content-type': /application\/json/ }
const jsonHeader = { 'content-type': 'application/json' }

function postFeedbackWithLogin(comment, userId) {
  return frisby.post(REST_URL + '/user/login', {
    headers: jsonHeader,
    body: {
      email: 'bjoern.kimminich@gmail.com',
      password: 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI='
    }
  })
    .expect('status', 200)
    .then(({ json: jsonLogin }) => {
      return frisby.get(REST_URL + '/captcha')
        .expect('status', 200)
        .expect('header', 'content-type', /application\/json/)
        .then(({ json }) => {
          return frisby.post(API_URL + '/Feedbacks', {
            headers: { Authorization: 'Bearer ' + jsonLogin.authentication.token, 'content-type': 'application/json' },
            body: {
              comment: comment,
              rating: 5,
              UserId: userId,
              captchaId: json.captchaId,
              captcha: json.answer
            }
          })
            .expect('status', 201)
            .expect('header', 'content-type', /application\/json/)
            .expect('json', 'data', {
              UserId: userId
            })
        })
    })
}

describe('/api/Feedbacks', () => {
  it('GET all feedback', () => {
    return frisby.get(API_URL + '/Feedbacks')
      .expect('status', 200)
  })

  it('POST sanitizes unsafe HTML from comment', () => {
    return frisby.get(REST_URL + '/captcha')
      .expect('status', 200)
      .expect('header', 'content-type', /application\/json/)
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: {
            comment: 'I am a harm<script>steal-cookie</script><img src="csrf-attack"/><iframe src="evil-content"></iframe>less comment.',
            rating: 1,
            captchaId: json.captchaId,
            captcha: json.answer
          }
        })
          .expect('status', 201)
          .expect('json', 'data', {
            comment: 'I am a harmless comment.'
          })
      })
  })

  if (utils.isChallengeEnabled(challenges.persistedXssFeedbackChallenge)) {
    it('POST fails to sanitize masked XSS-attack by not applying sanitization recursively', () => {
      return frisby.get(REST_URL + '/captcha')
        .expect('status', 200)
        .expect('header', 'content-type', /application\/json/)
        .then(({ json }) => {
          return frisby.post(API_URL + '/Feedbacks', {
            headers: jsonHeader,
            body: {
              comment: 'The sanitize-html module up to at least version 1.4.2 has this issue: <<script>Foo</script>iframe src="javascript:alert(`xss`)">',
              rating: 1,
              captchaId: json.captchaId,
              captcha: json.answer
            }
          })
            .expect('status', 201)
            .expect('json', 'data', {
              comment: 'The sanitize-html module up to at least version 1.4.2 has this issue: <iframe src="javascript:alert(`xss`)">'
            })
        })
    })
  }

  it('POST feedback in another users name as anonymous user', () => {
    return frisby.get(REST_URL + '/captcha')
      .expect('status', 200)
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: {
            comment: 'Lousy crap! You use sequelize 1.7.x? Welcome to SQL Injection-land, morons!',
            rating: 1,
            UserId: 3,
            captchaId: json.captchaId,
            captcha: json.answer
          }
        })
          .expect('status', 201)
          .expect('json', 'data', { UserId: 3 })
      })
  })

  it('POST feedback in a non-existing users name as anonymous user fails with constraint error', () => {
    return frisby.get(REST_URL + '/captcha')
      .expect('status', 200)
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: {
            comment: 'Pickle Rick says your express-jwt 0.1.3 has bugs!',
            rating: 0,
            UserId: 4711,
            captchaId: json.captchaId,
            captcha: json.answer
          }
        })
          .expect('status', 500)
          .then(({ json }) => {
            expect(json.errors).toContain('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed')
          })
      })
  })

  it('POST feedback is associated with current user', () => {
    return postFeedbackWithLogin(
      'Stupid JWT secret "' + security.defaultSecret + '" and being typosquatted by epilogue-js and anuglar2-qrcode!',
      4
    )
  })

  it('POST feedback is associated with any passed user ID', () => {
    return postFeedbackWithLogin('Bender\'s choice award!', 3)
  })

  it('POST feedback cannot be created without actually supplying rating', () => {
    return frisby.get(REST_URL + '/captcha')
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: { captchaId: json.captchaId, captcha: json.answer }
        })
          .expect('status', 400)
          .then(({ json }) => {
            expect(json.message.match(/notNull Violation: (Feedback\.)?rating cannot be null/))
          })
      })
  })

  it('POST feedback cannot be created with wrong CAPTCHA answer', () => {
    return frisby.get(REST_URL + '/captcha')
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: { rating: 1, captchaId: json.captchaId, captcha: (json.answer + 1) }
        })
          .expect('status', 401)
      })
  })
})

describe('/api/Feedbacks/:id', () => {
  it('GET existing feedback by id is forbidden via public API', () => {
    return frisby.get(API_URL + '/Feedbacks/1').expect('status', 401)
  })

  it('PUT update existing feedback is forbidden via public API', () => {
    return frisby.put(API_URL + '/Feedbacks/1', {
      headers: jsonHeader,
      body: { comment: 'Updated comment', rating: 1 }
    })
      .expect('status', 401)
  })

  it('DELETE existing feedback', () => {
    return frisby.get(REST_URL + '/captcha')
      .then(({ json }) => {
        return frisby.post(API_URL + '/Feedbacks', {
          headers: jsonHeader,
          body: { comment: 'I will be gone soon!', rating: 1, captchaId: json.captchaId, captcha: json.answer }
        })
          .expect('status', 201)
          .then(({ json }) => {
            return frisby.del(API_URL + '/Feedbacks/' + json.data.id, { headers: authHeader })
              .expect('status', 200)
          })
      })
  })
})
