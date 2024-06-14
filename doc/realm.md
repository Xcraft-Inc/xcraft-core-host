# Xcraft Realms

A realm is a security policy domain defined for a "thrall" server. The protected
resources on a server can be partitioned into a set of protection spaces, each
with its own authentication scheme and/or authorization database containing a
collection of users and groups.

For realm support you must add this line in the goblins.json:
`"useRealms": true`

# Content of a "Ork Realm Key"

Realm key is a JSON file with a dedicated extensions .ork In fact it's just an
portable config file creating an variant on the fly when loaded by core-host.

```json
{
  "xcraft-core-horde": {
    "topology": {
      "yeti-thrall": {
        "host": "127.0.0.1"
      }
    }
  },
  "goblin-wm": {
    "windowOptions": {
      "title": "Yeti - REALM"
    }
  }
}
```

The server or "guest" client certificate can be provided as BASE64 property.

# User realm key storage

Available realm keys is located in the fs, in the local app data folder of the
company providing the app: `/{appData}/{appCompany}/xcraft-realms`
