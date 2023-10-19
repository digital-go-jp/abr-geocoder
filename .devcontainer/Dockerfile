FROM node:18-slim

RUN apt-get update && apt-get install -y \
  locales \
  jq \
  git \
  sqlite3 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
RUN sed -i -E 's/# (ja_JP.UTF-8)/\1/' /etc/locale.gen \
  && locale-gen
ENV LANG ja_JP.UTF-8