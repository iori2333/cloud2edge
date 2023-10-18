#!/usr/bin/env bash

sudo ip link set dev tap100 down
sudo ip link del dev tap100
sudo ip tuntap add tap100 mode tap
sudo ip addr add 10.0.0.1/24 dev tap100
sudo ip link set dev tap100 up

solo5-hvt --net:service=tap100 -- dist/mirage-actor.hvt --ipv4=10.0.0.10/24
