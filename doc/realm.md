# Xcraft Realms

A realm is a security policy domain defined for a "thrall" server.
The protected resources on a server can be partitioned into a set of protection spaces, each with its own authentication scheme and/or authorization database containing a collection of users and groups.

# Content of a "Ork Realm Key"

Realm key is a JSON file with a dedicated extensions .ork
In fact it's just an portable config file creating an variant on the fly when loaded
by core-host.

## Xcraft config overrides

```json
{
  "xcraft-core-horde": {
    "topology": {
      "yeti-thrall": {
        "host": "192.168.7.56"
      }
    }
  }
}
```

## Server "realm" key

## Client "guest" key
