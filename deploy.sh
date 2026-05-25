#!/bin/bash
set -e

cd /home/ringdingdonghu/projects/travelPlanner_fe

git pull origin main
npm ci
npm run build
echo "travelPlanner_fe deployed"
