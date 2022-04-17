const CompanyError = require('app/exceptions/CompanyError');
const got = require("got");
const cheerio = require('cheerio');
const _ = require('lodash');
const { helper } = require('../services/utils');

module.exports = ({ log, properties, principal }) => {
    let $;
    return {
        async getCompany(usdot) {
            const parsed = await _parse(usdot);
            return _build(parsed);
        }
    }

    async function _parse(usdot) {
        log.info(`Get a company by usdot ${ usdot } from the SAFER system...`);

        const context = await got.get(properties.SAFER_URI + '&query_param=USDOT&query_string=' + usdot);
        $ = cheerio.load(context.body);

        if ($('BODY:contains("Record Inactive"),BODY:contains("Record Not Found"),BODY:contains("WELCOME TO SAFER")').text()) {
            throw new CompanyError(`Company with usdot ${ usdot } was not found in the SAFER system`);
        }

        const detailsSection = _getDetails($('table[width="70%"][cellspacing=0][cellpadding=4][summary="For formatting purpose"]')
            .find('td.queryfield,td[valign=top],td[align=center]'));
        const classificationSection = _toArray($('table[summary="Operation Classification"]')
            .find('td.queryfield + td'), true);
        const operationSection = _toArray($('table[summary="Carrier Operation"]')
            .find('td.queryfield + td'), true);
        const cargoSection = _toArray($('table[summary="Cargo Carried"]')
            .find('td.queryfield + td'), true);
        const inspectionsSection = _toArray($('table[summary="Inspections"]')
            .find('td.queryfield,td[valign=top],td[align=center]'));
        const crashesSection = _toArray($('table[summary="Crashes"]')
            .find('td.queryfield,td[valign=top],td[align=center]'));
        const reviewSection = _toArray($('table[summary="Review Information"]')
            .find('td.queryfield,td[valign=top],td[align=center]'));
        const summaryData = [];
        $('FONT[color=#0000C0][face!=arial]').each((i, element) => {
            const content = $(element).text().trim();
            (/^\d/).test(content) && summaryData.push(content.substring(0, 10))
        });
        return {
            detailsSection, classificationSection, operationSection, cargoSection,
            inspectionsSection, crashesSection, reviewSection, summaryData
        }
    }

    function _getDetails(elements) {
        const list = [];
        $(elements).each((i, element) => {
            i <= 15 && list.push($(element).text().trim())
        })
        list[5] = $(elements.get(5)).html()
        list[7] = $(elements.get(7)).html()
        return list;
    }

    function _toArray(elements, ofObjects) {
        const list = [];
        $(elements).each((i, element) => {
            $(element).text() && (ofObjects ?
                list.push({ key: $(element).text().trim(), value: !!$(element).prev().text().trim() })
                : list.push($(element).text().trim()))
        })
        return list;
    }

    function _build(parsed) {
        const address = _getAddress(parsed.detailsSection[5]);
        const mailAddress = _getAddress(parsed.detailsSection[7])
        return {
            name: _toStartCase(parsed.detailsSection[3]),
            dbaName: parsed.detailsSection[4] || 'n/a',
            mcNumber: parsed.detailsSection[10] || 'n/a',
            usdotNumber: parsed.detailsSection[8],
            address: {
                addressLine1: _toStartCase(address.addressLine1),
                addressLine2: 'n/a',
                cityName: _toStartCase(address.cityName),
                regionCode: address.regionCode,
                regionName: 'n/a',
                countryCode: 'US',
                countryName: 'United States',
                postCode: address.postCode
            },
            mailAddress: {
                addressLine1: _toStartCase(mailAddress.addressLine1),
                addressLine2: 'n/a',
                cityName: _toStartCase(mailAddress.cityName),
                regionCode: mailAddress.regionCode,
                regionName: 'n/a',
                countryCode: 'US',
                countryName: 'United States',
                postCode: mailAddress.postCode
            },
            phoneNumber: parsed.detailsSection[6] ? _reformatPhone(parsed.detailsSection[6]) : principal.user.phone_number,
            phoneCountryCode: parsed.detailsSection[6] ? 'US' : principal.user.phoneCountryCode,
            type: _toStartCase(parsed.detailsSection[0] || 'n/a'),
            saferCompany: {
                details: {
                    status: _toStartCase(parsed.detailsSection[1]),
                    outOfService: parsed.detailsSection[2],
                    stateCarrierNumber: parsed.detailsSection[9],
                    dunsNumber: parsed.detailsSection[11],
                    powerUnits: parsed.detailsSection[12],
                    drivers: parsed.detailsSection[13],
                    mcs150FormDate: parsed.detailsSection[14],
                    mcs150Mileage: parsed.detailsSection[15],
                    informationAsOfDate: parsed.summaryData[0],
                    classification: parsed.classificationSection,
                    operations: parsed.operationSection,
                    cargo: parsed.cargoSection
                },
                inspectionsInUS: {
                    inspectionAsOfDate: parsed.summaryData[1],
                    totalInspections: parsed.summaryData[2],
                    totalIepInspections: parsed.summaryData[3],
                    crashesAsOfDate: parsed.summaryData[4],
                    inspections: {
                        vehicle: parsed.inspectionsSection[0],
                        driver: parsed.inspectionsSection[1],
                        hazmat: parsed.inspectionsSection[2],
                        iep: parsed.inspectionsSection[3]
                    },
                    outOfService: {
                        vehicle: parsed.inspectionsSection[4],
                        driver: parsed.inspectionsSection[5],
                        hazmat: parsed.inspectionsSection[6],
                        iep: parsed.inspectionsSection[7]
                    },
                    outOfServiceInPercent: {
                        vehicle: parsed.inspectionsSection[8],
                        driver: parsed.inspectionsSection[9],
                        hazmat: parsed.inspectionsSection[10],
                        iep: parsed.inspectionsSection[11]
                    },
                    natAverage: {
                        vehicle: parsed.inspectionsSection[12],
                        driver: parsed.inspectionsSection[13],
                        hazmat: parsed.inspectionsSection[14],
                        iep: parsed.inspectionsSection[15]
                    },
                    crashes: {
                        fatal: parsed.crashesSection[0],
                        injury: parsed.crashesSection[1],
                        tow: parsed.crashesSection[2],
                        total: parsed.crashesSection[3]
                    }
                },
                inspectionsInCanada: {
                    inspectionAsOfDate: parsed.summaryData[5],
                    totalInspections: parsed.summaryData[6],
                    crashesAsOfDate: parsed.summaryData[7],
                    inspections: {
                        vehicle: parsed.inspectionsSection[16],
                        driver: parsed.inspectionsSection[17]
                    },
                    outOfService: {
                        vehicle: parsed.inspectionsSection[18],
                        driver: parsed.inspectionsSection[19]
                    },
                    outOfServiceInPercent: {
                        vehicle: parsed.inspectionsSection[20],
                        driver: parsed.inspectionsSection[21]
                    },
                    crashes: {
                        fatal: parsed.crashesSection[4],
                        injury: parsed.crashesSection[5],
                        tow: parsed.crashesSection[6],
                        total: parsed.crashesSection[7]
                    }
                },
                safetyRating: {
                    reportAsOfDate: parsed.summaryData[8],
                    ratingData: {
                        ratingDate: parsed.reviewSection[0],
                        reviewDate: parsed.reviewSection[1],
                        rating: parsed.reviewSection[2],
                        type: parsed.reviewSection[3]
                    }
                }
            }
        }
    }

    function _getAddress(singleLineAddress) {
        const pattern = /^\W+(.+)<.+\s+(.+),\s+(\w+)\s+&nbsp;\s+([\d-]+)/;
        if (pattern.test(singleLineAddress)) {
            const matcher = (singleLineAddress).match(pattern);
            return { addressLine1: matcher[1], cityName: matcher[2], regionCode: matcher[3], postCode: matcher[4] }
        } else {
            return { addressLine1: 'n/a', cityName: 'n/a', regionCode: 'n/a', postCode: 'n/a' }
        }
    }

    function _reformatPhone(phone) {
        return `+1${ phone.replace(/\D/g, '') }`;
    }

    function _toStartCase(text) {
        return helper.capitalizeString(text);
    }

};
