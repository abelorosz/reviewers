const core = require('@actions/core')
const github = require('@actions/github')

async function run() {
  try {
    const token = core.getInput('token', { required: true })
    console.log('Token obtained:', !!token)

    const octokit = github.getOctokit(token)
    console.log('Octokit initialized:', !!octokit)

    const { owner, repo, number } = github.context.issue
    console.log(`Owner: ${owner}, Repo: ${repo}, PR Number: ${number}`)

    // Fetch existing review requests
    const { data: reviewRequests } =
      await octokit.rest.pulls.listRequestedReviewers({
        owner,
        repo,
        pull_number: number
      })

    console.log(`ReviewRequests: ${JSON.stringify(reviewRequests)}`)

    const teams = reviewRequests.teams
    if (!teams.length) {
      console.log('No teams are assigned as reviewers.')
      return
    }

    // Collect individual members from the assigned teams
    const memberLogins = []
    for (const team of teams) {
      const { data: teamMembers } = await octokit.rest.teams.listMembersInOrg({
        org: owner,
        team_slug: team.slug
      })
      const memberUsernames = teamMembers.map(member => member.login)
      memberLogins.push(...memberUsernames)
    }

    // Remove teams from reviewers
    await octokit.rest.pulls.removeRequestedReviewers({
      owner,
      repo,
      pull_number: number,
      team_reviewers: teams.map(team => team.slug)
    })

    // Add individual members as reviewers
    await octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: number,
      reviewers: memberLogins
    })

    console.log(
      `Successfully replaced team reviewers with individual team members: ${memberLogins}`
    )
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

run()
