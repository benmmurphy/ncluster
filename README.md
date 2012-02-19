Cluster solution based on node's cluster module.

#Features

* Restarts workers that die
* Zero downtime reloading of application when receiving SIGHUP

#Issues

* Not enough testing
* Nodejs's cluster module doesn't appear to be fair (possibly why people have created their own nodejs http proxy balancers)

#Related

* http://learnboost.github.com/cluster/
* https://github.com/LearnBoost/up
* https://github.com/LearnBoost/distribute
