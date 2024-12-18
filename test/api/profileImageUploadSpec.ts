/*
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import frisby = require('frisby')
import config from 'config'
import path from 'path'
const fs = require('fs')

const jsonHeader = { 'content-type': 'application/json' }
const REST_URL = 'http://localhost:3000/rest'
const URL = 'http://localhost:3000'

// Helper function to perform login and return a token
function loginAndGetToken(email: string, password: string) {
  return frisby.post(`${REST_URL}/user/login`, {
    headers: jsonHeader,
    body: { email, password }
  })
    .expect('status', 200)
    .then(({ json }) => json.authentication.token)
}

// Helper function to upload a file
function uploadFile(endpoint: string, filePath: string, token?: string) {
  const file = path.resolve(__dirname, filePath)
  const form = frisby.formData()
  form.append('file', fs.createReadStream(file))

  const headers: Record<string, string> = {
    // @ts-expect-error FIXME form.getHeaders() is not found
    'Content-Type': form.getHeaders()['content-type']
  }
  if (token) {
    headers.Cookie = `token=${token}`
  }

  return frisby.post(endpoint, {
    headers,
    body: form,
    redirect: 'manual'
  })
}

// Helper function to upload a URL
function uploadURL(endpoint: string, imageUrl: string, token?: string) {
  const form = frisby.formData()
  form.append('imageUrl', imageUrl)

  const headers: Record<string, string> = {
    // @ts-expect-error FIXME form.getHeaders() is not found
    'Content-Type': form.getHeaders()['content-type']
  }
  if (token) {
    headers.Cookie = `token=${token}`
  }

  return frisby.post(endpoint, {
    headers,
    body: form,
    redirect: 'manual'
  })
}

describe('/profile/image/file', () => {
  it('POST profile image file valid for JPG format', () => {
    return loginAndGetToken(`jim@${config.get<string>('application.domain')}`, 'ncc-1701')
      .then(token => uploadFile(`${URL}/profile/image/file`, '../files/validProfileImage.jpg', token))
      .expect('status', 302)
  })

  it('POST profile image file invalid type', () => {
    return loginAndGetToken(`jim@${config.get<string>('application.domain')}`, 'ncc-1701')
      .then(token => uploadFile(`${URL}/profile/image/file`, '../files/invalidProfileImageType.docx', token))
      .expect('status', 415)
      .expect('header', 'content-type', /text\/html/)
      .expect('bodyContains', `<h1>${config.get<string>('application.name')} (Express`)
      .expect('bodyContains', 'Error: Profile image upload does not accept this file type')
  })

  it('POST profile image file forbidden for anonymous user', () => {
    return uploadFile(`${URL}/profile/image/file`, '../files/validProfileImage.jpg')
      .expect('status', 500)
      .expect('header', 'content-type', /text\/html/)
      .expect('bodyContains', 'Error: Blocked illegal activity')
  })
})

describe('/profile/image/url', () => {
  it('POST profile image URL valid for image available online', () => {
    return loginAndGetToken(`jim@${config.get<string>('application.domain')}`, 'ncc-1701')
      .then(token => uploadURL(`${URL}/profile/image/url`, 'https://placekitten.com/g/100/100', token))
      .expect('status', 302)
  })

  it('POST profile image URL redirects even for invalid image URL', () => {
    return loginAndGetToken(`jim@${config.get<string>('application.domain')}`, 'ncc-1701')
      .then(token => uploadURL(`${URL}/profile/image/url`, 'https://notanimage.here/100/100', token))
      .expect('status', 302)
  })

  xit('POST profile image URL forbidden for anonymous user', () => { // FIXME runs into "socket hang up"
    return uploadURL(`${URL}/profile/image/url`, 'https://placekitten.com/g/100/100')
      .expect('status', 500)
      .expect('header', 'content-type', /text\/html/)
      .expect('bodyContains', 'Error: Blocked illegal activity')
  })
})