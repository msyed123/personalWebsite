<template>
<div>
    <div v-if="loading">
        <b-card
        no-body
        style="width: 100%"
        border-variant="primary"
        header-bg-variant="primary"
        header-text-variant="white" 
        class="mx-auto"
        header="Loading...">
            <Loading />
        </b-card>
    </div>
    <div v-else>
        
        <b-button @click="revealTeam" v-show="currentTeamIndex >= 0" block size="lg" variant="danger">Reveal Pick {{currentTeamIndex + 1}}</b-button>
        <TransitionGroup tag="ul" name="slide">
            <li v-for="(dude, index) in revealedTeams" :key="dude.data.name[0].text">
                <b-card
                class="mx-auto"
                border-variant="primary"
                header-text-variant="dark"
                :img-src = "dude.data.picture.url"
                img-left
                >
                    <b-card-text>
                        <b-alert show variant="primary" class="pick">
                            Pick {{ dudes.length - revealedTeams.length + index + 1 }}</b-alert>
                        <div class="dude-name">{{ dude.data.name[0].text }}</div><br>
                        <div class="misc-text">2023 Final Standing: {{ dude.data.standing }}</div><br>
                        <div class="misc-text">2023 Record: {{ dude.data.previousrecord[0].text }}</div><br>
                        <div class="misc-text">2023 Team Name: {{ dude.data.previousteamname[0].text }}</div><br>
                    </b-card-text>
                </b-card>
            </li>
        </TransitionGroup>
    </div>
</div>    
</template>

<script>
import Loading from "~/components/Loading.vue";
import Prismic from "prismic-javascript";
// import PrismicDom from "prismic-dom";

export default {
    components: {
        Loading
    },
    data() {
        return{
            loading: true,
            dudes: [],
            revealedTeams: [],
            currentTeamIndex: null,
        };
    },

    methods: {
        async getDudes() {
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});

            const response = await api.query(
                Prismic.Predicates.at("document.type", "dude")
            )
            this.dudes = response.results.map(result => ({
                ...result,
                show: false
            }));
            
            // The randomization of the dude array happens here.
            let currentIndex = this.dudes.length;

            while (currentIndex != 0) {
                let randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;

                [this.dudes[currentIndex], this.dudes[randomIndex]] = [this.dudes[randomIndex], this.dudes[currentIndex]];
            }
            
            // Return the array. The slice will be re-rendered using an on-compute event hook.
            this.loading = false;
            this.currentTeamIndex = this.dudes.length - 1;
        },
        revealTeam() {
            if (this.currentTeamIndex >= 0) {
                this.revealedTeams.unshift(this.dudes[this.currentTeamIndex]);
                this.currentTeamIndex--;  // Move to the previous team
            }
        },
    },

    created () {
        this.getDudes()
    }
};
</script>

<style>
body{
	font-family: monaco, monospace;
}

*{
	padding: 0;
	margin: 0;
	box-sizing:border-box;
}

ul li{
	list-style-type: none;
	padding:10px;
}

.task{
	margin:5px;
	font-size: 16px;
}

.bar{
	width: 100%;
	background:#dfdfdf;
	overflow: hidden;
	padding:5px;
}

.progress{
	float:left;
	padding:15px;
}

.percent{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}

/* Transition classes for sliding in and down */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.5s cubic-bezier(0.55, 0, 0.1, 1), opacity 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* Slide in from the right */
.slide-enter {
  opacity: 0;
  transform: translateX(100%);
}

/* Ensure leaving items are taken out of layout flow */
.slide-leave-active {
  position: absolute;
  width: 100%; /* Ensures full width for sliding effect */
}

/* Slide down effect */
.slide-leave-to {
  transform: translateY(100%);
}

.pick {
    font-size: 1.25em
}

.dude-name {
    font-size: 1.25em;
    padding-left: 1.1em
}

.misc-text {
    padding-left: 1.25em
}
</style>
