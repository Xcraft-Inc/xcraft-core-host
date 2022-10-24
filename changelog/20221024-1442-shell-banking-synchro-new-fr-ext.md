# Support en cas de blocage des logiciels par un proxy.

Dans certaines infrastructures réseau, les logiciels Goblins peuvent afficher, durant l'installation ou leur utilisation, un message similaire à :

```
connexion à Internet absente
```

Dans ce genre de cas il est possible que tout accès à l'exterieur doive se faire via un proxy réseau.
Afin que les logiciels puissent fonctionner correctement, sur tous les postes concernés il faut ajouter les **variables d'environnement système** suivantes:

```
HTTP_PROXY = proxy.monentreprise.ch
HTTPS_PROXY = proxy.monentreprise.ch
```

Il est recommandé à ce que ces variables d'environnement **ne commencent pas** par _http://_ ou _https://_
