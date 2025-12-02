#!/usr/bin/env bash

npx prisma generate
npx prisma db push
echo "built!"
