Requirements:
- Docker
- Ngrok - [Download](https://ngrok.com/download/linux)
- Any Browser


## Create a container for jenkins:
```bash
docker run -d --name jenkins \
	-p 8080:8080 \
	-p 50000:50000 \
	 -v jenkins_home:/var/jenkins_home \  
	 jenkins/jenkins:lts
```

>The -v argument saves your configurations on your system, outside the container.
 jenkins_home = directory on your system where the container saves configurations
 /var/jenkins_home = directory inside the container where the configurations are stored
---

In a terminal, type:
```bash
ngrok http 8080
```

Open the link that appears next to Forwarding, in your browser
Example:
	Forwarding                    https://validly-unglimpsed-dinah.ngrok-free.dev

---

## Prepare Jenkins
Once inside Jenkins, go to:
**Configuration -> System**

Find Jenkins Location
Paste the Ngrok URL (https://validly-unglimpsed-dinah.ngrok-free.dev)

---
### Types of Items/Jobs
##### Freestyle Project
This is the most basic type of project. You configurate everything through the Web IU by filling forms ans selecting options.
Just use this type for fast scripts or small projects where the version control and history changesa aren't required. 


##### Pipeline
Instead of fill forms, you write a script called Jenkinsfile. 
This file defines all the construction, test and deployment process.
It allows creating complex workflows and managing issues in projects that require robust CI/CD.
**Supports only one branch.**

##### Multibranch Pipeline
Designed for more complex wprkflows based on branches. 
Instead of creating a job for each branch (main, develop, ...), it scans the repository automatically.

---

### Requirements for Pipeline
##### SSH-Key (Docker)
In the terminal, enter the container:
```bash
docker exec -it jenkins bash
```

Once inside in Jenkins container, generate key:
```bash
ssh-keygen -t ed25519 -C "jenkins@access"
```

Press Enter or type yes when appears the next for default file location:
	`Enter file in which to save the key (/var/jenkins_home/.ssh/id_ed25519): yes`

Press Enter for to leave passphrase empty:
	```Enter passphrase for "/var/jenkins_home/.ssh/id_ed25519" (empty for no passphrase):
	Enter same passphrase again: 
	```

##### Credential for ssh (Jenkins) 
On Jenkins, go to:
**Configuration -> Credentials -> System -> Global**

Select **+Add Credential**
Select **SSH Username with private key**
	ID:
		github-ssh-key (or any name)
	Description:
		SSH Key
	Username:
		git
	Private key:
		Enter directly ->	Copy and Paste all the result of the next command in your jenkins container:
```bash
			cat /var/jenkins_home/.ssh/id_ed25519
```
	Passphrase:
		(Empty)


##### SSH-key (Github)
On Github, go to:
**Settings -> SSH and GPG keys**

Select New SSH Key

Title:
	Jenkins
Key:
	Copy and Paste all the result of the next command in your jenkins container:
```bash
			cat /var/jenkins_home/.ssh/id_ed25519.pub
```

---

### Requirements for Multibranch Pipeline

##### Create Access token (Github)
On Github, go to: 
**Settings -> Developer Settings -> Personal acces tokens -> Tokens (classic)**

Select Generate New token (classic)

Add permissions for:
	- repo
	- admin:repo_hook
And Generate token

##### Create New Credential (Jenkins)
On Jenkins, go to:
**Configuration -> Credentials -> System -> Global**

Select +Add Credential

Select Username with password
	Scope:
		Global
	Username: 
		Your github's username
	Password:
		Copy and paste the token (classic) made on github
	ID:
		github-key (or whatever)

---

## Create Pipeline

Create a Item:
Type any name.

Select:
	-Pipeline -> for only a single branch
	-Multibranch Pipeline -> for two or more branches

---

### Pipeline Configuration
Pipepline
General:
	Enable Github Project
	Add the repository URL
	
Triggers:
	Enable Github Hook trigger for GITScm polling
	
Pipeline section:
	Pipeline script:
		 Pipeline script → for the first time or if you don't have a Jenkinsfile yet
		 Pipeline script from SCM → recommended 
	Pipeline script from SCM:
		SCM:
			Git
		Repositories:
			Repository URL:
				SSH: git@github.com:User/Title.git
				HTTPS: https://github.com/User/Ttile.git
			Credentials:
				Select SSH key. 
			Branches to build:
				At least, `*/main`
			Repository Browser:
				(Auto)
		Script Path:
			Default: `Jenkinsfile` 
			Or: `/directory/Jenkinsfile`
			

---

### Configuration Multibranch Pipeline
Branch Sources:
	Credentials
		Select Github token (Username with Password)
		Repository URL: HTTPS
	Behaviors:
		Enable:
			- Discover branch
			- Discover pull request from forks
			- Discover pull request from origin
			
Build Configuration
	Mode:
		by Jenkinsfile 
		-Script Path:
			Default: `Jenkinsfile` 
			Or: `/directory/Jenkinsfile`
	Scan by webhook:
		Enable

---

## Configure Repository
On github, go to:
**Repository -> Settings -> Webhook**

Select Add Webhook
	Payload URL:
		Paste Ngrok URL
	Content/type:
		application/json
	Secret:
		Empty
	SSL:
		Enable
	Events:
		Just push the events
	Active
Add	webhook
