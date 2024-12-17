import frisby = require('frisby')
import { expect } from '@jest/globals'
import config from 'config'
import path from 'path'

const fs = require('fs')

const jsonHeader = { 'content-type': 'application/json' }
const REST_URL = 'http://localhost:3000/rest'

// Helper function: Login a user and return the authentication token
function loginUser(email: string, password: string) {
  return frisby.post(REST_URL + '/user/login', {
    headers: jsonHeader,
    body: { email, password }
  })
    .expect('status', 200)
    .then(({ json }) => json.authentication.token)
}

// Helper function: Retrieve CAPTCHA answer
function getCaptcha(authToken: string) {
  return frisby.get(REST_URL + '/image-captcha', {
    headers: { Authorization: `Bearer ${authToken}`, 'content-type': 'application/json' }
  })
    .expect('status', 200)
    .expect('header', 'content-type', /application\/json/)
    .then(({ json }) => json.answer)
}

// Helper function: Export user data and verify the response
function exportUserData(authToken: string, body: any, assertions: (parsedData: any) => void) {
  return frisby.post(REST_URL + '/user/data-export', {
    headers: { Authorization: `Bearer ${authToken}`, 'content-type': 'application/json' },
    body
  })
    .expect('status', 200)
    .expect('header', 'content-type', /application\/json/)
    .expect('json', 'confirmation', 'Your data export will open in a new Browser window.')
    .then(({ json }) => {
      const parsedData = JSON.parse(json.userData)
      assertions(parsedData)
    })
}

describe('/rest/user/data-export', () => {
  it('Export data without use of CAPTCHA', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=').then(authToken => {
      return exportUserData(authToken, { format: '1' }, parsedData => {
        expect(parsedData.username).toBe('bkimminich')
        expect(parsedData.email).toBe('bjoern.kimminich@gmail.com')
      })
    })
  })

  it('Export data when CAPTCHA requested need right answer', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=').then(authToken => {
      return getCaptcha(authToken).then(() => {
        return frisby.post(REST_URL + '/user/data-export', {
          headers: { Authorization: `Bearer ${authToken}`, 'content-type': 'application/json' },
          body: { answer: 'AAAAAA', format: 1 }
        })
          .expect('status', 401)
          .expect('bodyContains', 'Wrong answer to CAPTCHA. Please try again.')
      })
    })
  })

  it('Export data using right answer to CAPTCHA', () => {
    return loginUser('bjoern.kimminich@gmail.com', 'bW9jLmxpYW1nQGhjaW5pbW1pay5ucmVvamI=').then(authToken => {
      return getCaptcha(authToken).then(captchaAnswer => {
        return exportUserData(authToken, { answer: captchaAnswer, format: 1 }, parsedData => {
          expect(parsedData.username).toBe('bkimminich')
          expect(parsedData.email).toBe('bjoern.kimminich@gmail.com')
        })
      })
    })
  })

  it('Export data including orders without use of CAPTCHA', () => {
    return loginUser('amy@' + config.get<string>('application.domain'), 'K1f.....................').then(authToken => {
      return frisby.post(REST_URL + '/basket/4/checkout', {
        headers: { Authorization: `Bearer ${authToken}`, 'content-type': 'application/json' }
      })
        .expect('status', 200)
        .then(() => {
          return exportUserData(authToken, { format: '1' }, parsedData => {
            expect(parsedData.username).toBe('')
            expect(parsedData.email).toBe('amy@' + config.get<string>('application.domain'))
            expect(parsedData.orders[0].totalPrice).toBe(9.98)
            expect(parsedData.orders[0].products[0].name).toBe('Raspberry Juice (1000ml)')
          })
        })
    })
  })

  it('Export data including memories with use of CAPTCHA', () => {
    const file = path.resolve(__dirname, '../files/validProfileImage.jpg')
    const form = frisby.formData()
    form.append('image', fs.createReadStream(file), 'Valid Image')
    form.append('caption', 'Valid Image')

    return loginUser('jim@' + config.get<string>('application.domain'), 'ncc-1701').then(authToken => {
      return frisby.post(REST_URL + '/memories', {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': form.getHeaders()['content-type'] },
        body: form
      })
        .expect('status', 200)
        .then(() => {
          return getCaptcha(authToken).then(captchaAnswer => {
            return exportUserData(authToken, { answer: captchaAnswer, format: 1 }, parsedData => {
              expect(parsedData.username).toBe('')
              expect(parsedData.email).toBe('jim@' + config.get<string>('application.domain'))
              expect(parsedData.memories[0].caption).toBe('Valid Image')
            })
          })
        })
    })
  })
})
