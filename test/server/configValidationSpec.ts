/* 
 * Copyright (c) 2014-2024 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import chai = require('chai')
import sinonChai = require('sinon-chai')
import validateConfig from '../../lib/startup/validateConfig'

const expect = chai.expect
chai.use(sinonChai)

const {
  checkUnambiguousMandatorySpecialProducts,
  checkUniqueSpecialOnProducts,
  checkYamlSchema,
  checkMinimumRequiredNumberOfProducts,
  checkUnambiguousMandatorySpecialMemories,
  checkMinimumRequiredNumberOfMemories,
  //checkUniqueSpecialOnMemories,
  //checkSpecialMemoriesHaveNoUserAssociated,
  checkNecessaryExtraKeysOnSpecialProducts
} = require('../../lib/startup/validateConfig')

// Helper Function: Reusable product tests
function testProducts(
  testFunction: (products: any[]) => boolean,
  validConfig: any[],
  invalidConfig: any[],
  errorCondition: string
) {
  it('should accept a valid config', () => {
    expect(testFunction(validConfig)).to.equal(true)
  })

  it(`should fail if ${errorCondition}`, () => {
    expect(testFunction(invalidConfig)).to.equal(false)
  })
}

describe('configValidation', () => {
  describe('checkUnambiguousMandatorySpecialProducts', () => {
    const validProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true },
      { name: 'Orange Juice', urlForProductTamperingChallenge: 'foobar' },
      { name: 'Melon Juice', fileForRetrieveBlueprintChallenge: 'foobar', exifForBlueprintChallenge: ['OpenSCAD'] },
      { name: 'Rippertuer Special Juice', keywordsForPastebinDataLeakChallenge: ['bla', 'blubb'] }
    ]

    const invalidProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true },
      { name: 'Melon Bike', useForChristmasSpecialChallenge: true }
    ]

    testProducts(
      checkUnambiguousMandatorySpecialProducts,
      validProducts,
      invalidProducts,
      'multiple products are configured for the same challenge'
    )
  })

  describe('checkNecessaryExtraKeysOnSpecialProducts', () => {
    const validProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true },
      { name: 'Orange Juice', urlForProductTamperingChallenge: 'foobar' },
      { name: 'Melon Juice', fileForRetrieveBlueprintChallenge: 'foobar', exifForBlueprintChallenge: ['OpenSCAD'] },
      { name: 'Rippertuer Special Juice', keywordsForPastebinDataLeakChallenge: ['bla', 'blubb'] }
    ]

    const invalidProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true },
      { name: 'Orange Juice', urlForProductTamperingChallenge: 'foobar' },
      { name: 'Melon Juice', fileForRetrieveBlueprintChallenge: 'foobar' }
    ]

    testProducts(
      checkNecessaryExtraKeysOnSpecialProducts,
      validProducts,
      invalidProducts,
      'product has no exifForBlueprintChallenge'
    )
  })

  describe('checkUniqueSpecialOnProducts', () => {
    const validProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true },
      { name: 'Orange Juice', urlForProductTamperingChallenge: 'foobar' },
      { name: 'Melon Juice', fileForRetrieveBlueprintChallenge: 'foobar', exifForBlueprintChallenge: ['OpenSCAD'] },
      { name: 'Rippertuer Special Juice', keywordsForPastebinDataLeakChallenge: ['bla', 'blubb'] }
    ]

    const invalidProducts = [
      { name: 'Apple Juice', useForChristmasSpecialChallenge: true, urlForProductTamperingChallenge: 'foobar' }
    ]

    testProducts(
      checkUniqueSpecialOnProducts,
      validProducts,
      invalidProducts,
      'a product is configured for multiple challenges'
    )
  })

  describe('checkMinimumRequiredNumberOfProducts', () => {
    const validProducts = [
      { name: 'Apple Juice' },
      { name: 'Orange Juice' },
      { name: 'Melon Juice' },
      { name: 'Rippertuer Special Juice' }
    ]

    const invalidProducts = [
      { name: 'Apple Juice' },
      { name: 'Orange Juice' },
      { name: 'Melon Juice' }
    ]

    testProducts(
      checkMinimumRequiredNumberOfProducts,
      validProducts,
      invalidProducts,
      'less than 4 products are configured'
    )
  })

  describe('checkUnambiguousMandatorySpecialMemories', () => {
    const validMemories = [
      { image: 'bla.png', geoStalkingMetaSecurityQuestion: 42, geoStalkingMetaSecurityAnswer: 'foobar' },
      { image: 'blubb.png', geoStalkingVisualSecurityQuestion: 43, geoStalkingVisualSecurityAnswer: 'barfoo' }
    ]

    const invalidMemories = [
      { image: 'bla.png', geoStalkingMetaSecurityQuestion: 42, geoStalkingMetaSecurityAnswer: 'foobar' },
      { image: 'lalala.png', geoStalkingMetaSecurityQuestion: 46, geoStalkingMetaSecurityAnswer: 'foobarfoo' }
    ]

    testProducts(
      checkUnambiguousMandatorySpecialMemories,
      validMemories,
      invalidMemories,
      'multiple memories are configured for the same challenge'
    )
  })

  // Repeat this pattern for other memory checks
  describe('checkMinimumRequiredNumberOfMemories', () => {
    const validMemories = [
      { image: 'bla.png', user: 'admin' },
      { image: 'blubb.png', user: 'bjoern' }
    ]

    const invalidMemories = [{ image: 'bla.png', user: 'admin' }]

    testProducts(
      checkMinimumRequiredNumberOfMemories,
      validMemories,
      invalidMemories,
      'less than 2 memories are configured'
    )
  })

  it(`should accept the active config from config/${process.env.NODE_ENV}.yml`, async () => {
    expect(await validateConfig({ exitOnFailure: false })).to.equal(true)
  })

  it('should fail if the config is invalid', async () => {
    expect(await validateConfig({ products: [], exitOnFailure: false })).to.equal(false)
  })

  it('should accept a config with valid schema', () => {
    const config = {
      application: { domain: 'juice-b.ox', name: 'OWASP Juice Box', welcomeBanner: { showOnFirstStart: false } },
      hackingInstructor: { avatarImage: 'juicyEvilWasp.png' }
    }

    expect(checkYamlSchema(config)).to.equal(true)
  })

  it('should fail for a config with schema errors', () => {
    const config = {
      application: { domain: 42, id: 'OWASP Juice Box', welcomeBanner: { showOnFirstStart: 'yes' } },
      hackingInstructor: { avatarImage: true }
    }

    expect(checkYamlSchema(config)).to.equal(false)
  })
})
