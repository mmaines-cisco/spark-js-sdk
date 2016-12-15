ansiColor('xterm') {
  timestamps {
    timeout(90) {

      node("SPARK_JS_SDK_VALIDATING") {
        env.CONCURRENCY = 4
        env.NPM_CONFIG_REGISTRY = "http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group"
        env.ENABLE_VERBOSE_NETWORK_LOGGING = true

        DOCKER_CONTAINER_NAME = "${JOB_NAME}-${BUILD_NUMBER}-builder"

        DOCKER_ENV_FILE = "${pwd}/docker-env"

        DOCKER_RUN_OPTS = ""
        DOCKER_RUN_OPTS += " --env-file ${DOCKER_ENV_FILE}"
        DOCKER_RUN_OPTS += " --rm"
        DOCKER_RUN_OPTS += " -e NPM_CONFIG_CACHE=${env.WORKSPACE}/.npm"
        DOCKER_RUN_OPTS += " --volumes-from ${env.HOSTNAME}"
        DOCKER_RUN_OPTS += sh script: '--user=$(id -u):$(id -g)', returnStdout: true
        DOCKER_RUN_OPTS += " ${DOCKER_CONTAINER_NAME}"

        def dockerEnv = ""
        dockerEnv+="ATLAS_SERVICE_URL=${env.ATLAS_SERVICE_URL}\n"
        dockerEnv+="BUILD_NUMBER=${env.BUILD_NUMBER}\n"
        dockerEnv+="CISCOSPARK_APPID_ORGID=${env.CISCOSPARK_APPID_ORGID}\n"
        dockerEnv+="CONVERSATION_SERVICE=${env.CONVERSATION_SERVICE}\n"
        dockerEnv+="COMMON_IDENTITY_OAUTH_SERVICE_URL=${env.COMMON_IDENTITY_OAUTH_SERVICE_URL}\n"
        dockerEnv+="DEVICE_REGISTRATION_URL=${env.DEVICE_REGISTRATION_URL}\n"
        dockerEnv+="ENABLE_NETWORK_LOGGING=${env.ENABLE_NETWORK_LOGGING}\n"
        dockerEnv+="ENABLE_VERBOSE_NETWORK_LOGGING=${env.ENABLE_VERBOSE_NETWORK_LOGGING}\n"
        dockerEnv+="HYDRA_SERVICE_URL=${env.HYDRA_SERVICE_URL}\n"
        dockerEnv+="PIPELINE=${env.PIPELINE}\n"
        dockerEnv+="SAUCE_IS_DOWN=${env.SAUCE_IS_DOWN}\n"
        dockerEnv+="SDK_BUILD_DEBUG=${env.SDK_BUILD_DEBUG}\n"
        dockerEnv+="SKIP_FLAKY_TESTS=${env.SKIP_FLAKY_TESTS}\n"
        dockerEnv+="WDM_SERVICE_URL=${env.WDM_SERVICE_URL}\n"
        dockerEnv+="WORKSPACE=${env.WORKSPACE}\n"
        writeFile(DOCKER_ENV_FILE, dockerEnv)

        def secrets = ""
        secrets += "COMMON_IDENTITY_CLIENT_SECRET=${env.CISCOSPARK_CLIENT_SECRET}"
        secrets += "CISCOSPARK_APPID_SECRET=${env.CISCOSPARK_APPID_SECRET}"
        secrets += "CISCOSPARK_CLIENT_SECRET=${env.CISCOSPARK_CLIENT_SECRET}"
        secrets += "SAUCE_USERNAME=${env.SAUCE_USERNAME}"
        secrets += "SAUCE_ACCESS_KEY=${env.SAUCE_ACCESS_KEY}"
        writeFile('.env', secrets);

        stage('checkout') {
          // TODO this should be change to `checkout scm` once this script moves
          // to the repo
          // checkout scm

          sshagent(['30363169-a608-4f9b-8ecc-58b7fb87181b']) {
            sh 'git clone git@github.com:ciscospark/spark-js-sdk.git'
          }
        }

        stage('docker build') {
          sh "echo \"RUN groupadd -g $(id -g) jenkins\" >> ./docker/builder/Dockerfile"
          sh "echo \"RUN useradd -u $(id -u) -g $(id -g) -m jenkins\" >> ./docker/builder/Dockerfile"
          sh "echo \"WORKDIR ${env.WORKDIR}\" >> ./docker/builder/Dockerfile"
          sh "echo \"USER $(id -u)\" >> ./docker/builder/Dockerfile"

          retry(3) {
            sh "docker build -t ${DOCKER_CONTAINER_NAME} ./docker/builder"
            // Reset the Dockerfile to make sure we don't accidentally commit it
            // later
            sh "git checkout ./docker/builder/Dockerfile"
          }
        }

        stage('clean') {
          sh "docker run ${DOCKER_RUN_OPTS} npm run grunt -- clean"
          sh "docker run ${DOCKER_RUN_OPTS} npm run grunt:concurrent -- clean"
          sh "docker run ${DOCKER_RUN_OPTS} npm run clean-empty-packages"
          sh 'rm -rf ".sauce/*/sc.*"'
          sh 'rm -rf ".sauce/*/sauce_connect*log"'
          sh 'rm -rf reports'
          sh 'mkdir -p reports/coverage'
          sh 'mkdir -p reports/coverage-final'
          sh 'mkdir -p reports/junit'
          sh 'mkdir -p reports/logs'
          sh 'mkdir -p reports/sauce'
          sh 'chmod -R ugo+w reports'
        }

        stage('install') {
          sh "docker run ${DOCKER_RUN_OPTS} npm install"
          sh "docker run ${DOCKER_RUN_OPTS} npm run bootstrap"
        }

        stage('build') {
          sh "docker run ${DOCKER_RUN_OPTS} npm run build"
        }

        stage('test') {
          withCredentials([
            string(credentialsId: '9f44ab21-7e83-480d-8fb3-e6495bf7e9f3', variable: 'CISCOSPARK_CLIENT_SECRET'),
            string(credentialsId: 'CISCOSPARK_APPID_SECRET', variable: 'CISCOSPARK_APPID_SECRET'),
            usernamePassword(credentialsId: 'SAUCE_LABS_VALIDATED_MERGE_CREDENTIALS', passwordVariable: 'SAUCE_ACCESS_KEY', usernameVariable: 'SAUCE_USERNAME')
          ]) {
            sh './tooling/test.sh'
          }
        }

        stage('process coverage') {
          sh 'npm run grunt:circle -- coverage'

          // At the time this script was written, the cobertura plugin didn't yet
          // support pipelines, so we need to use a freeform job to process code
          // coverage
          coverageBuild = build job: 'spark-js-sdk--validated-merge--coverage-processor', propagate: false
          echo coverageBuild.result
        }
        stage('publish') {
          // NPM_TOKEN
        }
      }
    }
  }
}
// TODO always delete .env
