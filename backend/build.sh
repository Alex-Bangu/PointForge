#!/usr/bin/env bash
node install
npx prisma generate
npx prisma db push
