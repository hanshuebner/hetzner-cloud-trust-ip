require('dotenv').config()

const axios = require('axios')

const openPorts = {
    openvpn: [ 1194, 'udp'],
    dns: [ 53, 'udp' ],
}

const callHetznerCloud = async (method, url, data) =>
    axios.request({
        method,
        url,
        data,
        headers: { 'Authorization': `Bearer ${process.env.CLOUD_API_TOKEN}`},
        baseURL: `https://api.hetzner.cloud/v1`,
    })

const main = async (firewallName) => {
    if (!process.env?.REMOTE_ADDR || !process.env?.QUERY_STRING.match(/host=/)) {
        throw new Error("Missing REMOTE_ADDR or QUERY_STRING or host= not found in QUERY_STRING")
    }

    const ipAddress = process.env.REMOTE_ADDR
    const hostName = process.env.QUERY_STRING.replace(/.*host=(.*?)(\&.*$|$)/, "$1")

    console.log(`hostName ${hostName} ipAddress ${ipAddress}`)

    const { firewalls } = (await callHetznerCloud('GET', 'firewalls')).data

    const firewall = firewalls.filter(({ name }) => name === firewallName)[0]

    if (!firewall) {
        throw new Error(`firewall ${firewallName} not found in Hetzner Cloud`)
    }

    const rules = [
        ...firewall.rules.filter(({ description }) => !description.startsWith(`${hostName}/`)),
        ...Object.entries(openPorts).map(([service, [port, protocol]]) => ({
            direction: 'in',
            protocol,
            port: `${port}`,
            source_ips: [ `${ipAddress}/32` ],
            description: `${hostName}/${service}`
        }))
    ]

    await callHetznerCloud('POST', `firewalls/${firewall.id}/actions/set_rules`, { rules })
}

main(process.argv[2])
    .catch((e) => {
        if (e.response?.data?.error) {
            console.log('error', JSON.stringify(e.response.data.error, null, '  '))
        } else {
            console.log(e)
        }
        process.exit(2)
    })
