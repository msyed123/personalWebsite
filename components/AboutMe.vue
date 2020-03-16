<template>
    <section>
        <div>
            <br />
            <b-card
            no-body
            style="width: 85%"
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="mx-auto"
            header="Loading..."
            v-if="loading"
            >
                <Loading />
            </b-card>
            <b-card
                class="mx-auto"
                style="width: 85%"
                border-variant="primary"
                header="Interests"
                header-bg-variant="primary"
                header-text-variant="white"
            v-else
            >
                <b-list-group>
                    <b-list-group-item v-for="interest in interests" v-bind:key="interest.data.priority">
                        {{ interest.data.name[0].text }}
                    </b-list-group-item>
                </b-list-group>
            </b-card>

            <br />
            <Progress />

            <br />
            <b-card
            class="mx-auto overflow-hidden"
            border-variant="primary"
            style="width: 85%"
            >
                <b-row no-gutters align-v="center">
                    <b-col md="4">
                        <b-card-img :src="require('../assets/msyed.jpg')" class="rounded-0"></b-card-img>
                    </b-col>
                    <b-col>
                        <b-card-body title="About Me">
                            <b-card-text>
                                I am a native born Floridian with the goal of trying to figure out how to make
                                things go up. I have been very lucky to get to see the cutting edge of aerospace all
                                my life because I grew up on the Space Coast. I would like to contribute to that 
                                one day. Currently, I am enrolled in the Florida Institute of Technology, where I am
                                as of now a junior pursuing my bachelors in aerospace engineering. I expect to graduate in
                                the Spring semester of 2021. At school, I am actively involved in a variety of
                                organizations. I am the current team lead of our Hyperloop team, which has become
                                very succesful in recent years. I am also an active member of our local AIAA 
                                chapter, for which I am the current conference chair. Finally, I am active in
                                my local community, helping in STEM programs at local schools. In particular,
                                I am helping develop a UAS intro course for middle school students as that was
                                my first foray into aerospace too.
                            </b-card-text>
                        </b-card-body>
                    </b-col>
                </b-row>
            </b-card>
            <br />
        </div>
    </section>
</template>

<script>
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";
import PrismicConfig from "~/prismic.config.js";
import Progress from '~/components/Progress.vue';
import Loading from "~/components/Loading.vue";

export default {
    data () {
        return {
            loading: true,
            interests: []
        }
    },

    methods: {
        async getInterests() {
            const api = await Prismic.getApi(PrismicConfig.apiEndpoint, {accessToken: PrismicConfig.accessToken});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "interest"),
                { orderings : '[my.interest.priority]'}
            )
            this.interests = response.results;
            this.loading = false;
        }
    },

    created () {
        this.getInterests()
    },

    components: {
        Progress,
        Loading
    }
}
</script>

<style>
    h1{
        padding-top: 20px;
        padding-left: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
    p {
        padding-top: 20px;
        padding-left: 20px;
        padding-right: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
</style>
