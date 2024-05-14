FROM node:14.21.3

ENV LANG=C.UTF-8
ENV LANGUAGE=C.UTF-8

# Install the application
COPY package.json /app/package.json
COPY . /app/.
WORKDIR /app
RUN npm install

ENV PORT 8080
EXPOSE 8080

# Define command to run the application when the container starts
CMD ["node", "."]
