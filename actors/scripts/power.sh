curl -i -X POST -u ditto:ditto -H 'Content-Type: application/json' -w '\n' --data '{
  "power": "on"
}' http://localhost:32747/api/2/things/org.i2ec:air-purifier/inbox/messages/power?timeout=0