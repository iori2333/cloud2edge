curl -i -X POST -u ditto:ditto -H 'Content-Type: application/json' -w '\n' --data '{
  "fields": ["on"]
}' http://localhost:32747/api/2/things/org.i2ec:air-purifier/inbox/messages/query_state?timeout=10